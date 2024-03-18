import * as child_process from 'child_process'
import * as vscode from 'vscode'

import { alloglot } from './config'

export interface IDisposal extends vscode.Disposable {
  insert(disposable: vscode.Disposable): void
}

export namespace Disposal {
  /**
   * Create a {@link IDisposal disposal} that when disposed will dispose of all inserted disposables.
   */
  export function make(): IDisposal {
    const disposables: Array<vscode.Disposable> = []

    return {
      insert(disposable) {
        disposables.push(disposable)
      },

      dispose() {
        disposables.forEach(disposable => disposable.dispose())
      }
    }
  }
}

export interface IAsyncProcess<T> extends vscode.Disposable, Promise<T> { }

export namespace AsyncProcess {
  type Spec = {
    command: string
    basedir?: vscode.Uri
    stdin?: string
    output?: vscode.OutputChannel
  }

  /**
   * Create a (potentially) long-lived {@link IAsyncProcess async process}.
   * `spawn(spec)` runs a command and returns a promise that resolves when the process exits.
   * Method `dispose()` kills the process and is idempotent.
   */
  export function spawn(spec: Spec): IAsyncProcess<void> {
    return make<void>(spec, (cmd, opts, resolve) => {
      const proc = child_process.spawn(cmd, [], {...opts, shell: true})
      proc.on('exit', resolve)
      return proc
    })
  }

  /**
   * Create a short-lived {@link IAsyncProcess async process} that runs a command and returns a promise of the result.
   * `exec(spec, f)` computes the result by running the `f` on the process stdout.
   * Method `dispose()` kills the process and is idempotent.
   */
  export function exec<T>(spec: Spec, f: (stdout: string) => T): IAsyncProcess<T> {
    return make(spec, (cmd, opts, resolve) => {
      return child_process.exec(cmd, opts, (error, stdout, stderr) => {
        !stdout && spec.output?.appendLine(alloglot.ui.commandNoOutput(spec.command))
        resolve(f(stdout))
      })
    })
  }

  function make<T>(spec: Spec, makeProc: (command: string, opts: {cwd?: string, signal?: AbortSignal}, resolve: (t: T) => void) => child_process.ChildProcess): IAsyncProcess<T> {
    let controller: AbortController | undefined = new AbortController()
    const { signal } = controller

    const { output, command, basedir, stdin } = spec
    const cwd = basedir?.fsPath

    // giving this an `any` signature allows us to add a `dispose` method.
    // it's a little bit jank, but i don't know how else to do it.
    const asyncProc: any = new Promise<T>((resolve, reject) => {
      output?.appendLine(alloglot.ui.runningCommand(command, cwd))

      try {
        const proc = makeProc(command, { cwd, signal }, resolve)

        proc.on('error', error => {
          output?.appendLine(alloglot.ui.errorRunningCommand(command, error))
          reject(error)
        })

        proc.stdout?.on('data', chunk => output?.append(stripAnsi(chunk.toString())))
        proc.stderr?.on('data', chunk => output?.append(stripAnsi(chunk.toString())))

        stdin && proc.stdin?.write(stdin)
        proc.stdin?.end()
      } catch (err) {
        output?.appendLine(alloglot.ui.errorRunningCommand(command, err))
        reject(err)
      }
    })

    asyncProc.dispose = () => {
      if (controller) {
        try {
          output?.appendLine(alloglot.ui.killingCommand(command))
          controller.abort()
          controller = undefined // ensure `dispose()` is idempotent
          output?.appendLine(alloglot.ui.commandKilled(command))
        } catch (err) {
          output?.appendLine(alloglot.ui.errorKillingCommand(command, err))
        }
      }
    }

    asyncProc.then(() => output?.appendLine(alloglot.ui.ranCommand(command)))

    return asyncProc
  }

  const stripAnsi: (raw: string) => string = require('strip-ansi').default
}

export interface IHierarchicalOutputChannel extends vscode.OutputChannel {
  prefixPath: Array<string>
  local(prefix: string): IHierarchicalOutputChannel
  split(): IHierarchicalOutputChannel
}

export namespace HierarchicalOutputChannel {
  /**
   * Create an {@link IHierarchicalOutputChannel output channel} that can spawn children output channels that prefix lines with a path.
   * Method `local(prefix)` spawns a child channel with the supplied prefix appended to the prefix path. The spawned channel can spawn further children.
   * Method `split()` creates a separate output channel named after the current prefix path. It will have an empty prefix path.
   * Spawned channels will have the same name as the parent channel, so messages appear in the same output window.
   */
  export function make(name: string): IHierarchicalOutputChannel {
    return addTimestamps(makeNoTimestamps(name))
  }

  function makeNoTimestamps(name: string): IHierarchicalOutputChannel {
    return promote([], vscode.window.createOutputChannel(name))
  }

  function addTimestamps(output: IHierarchicalOutputChannel): IHierarchicalOutputChannel {
    return {
      ...output,

      append(value: string) {
        output.append(`[${timestamp()}] ${value}`)
      },

      appendLine(value: string) {
        output.appendLine(`[${timestamp()}] ${value}`)
      }
    }
  }

  function timestamp(): string {
    return new Date().toJSON().split('T')[1].replace(/\.\d*Z/, ' UTC')
  }

  function addPrefix(output: vscode.OutputChannel, prefix: string): vscode.OutputChannel {
    return {
      ...output,

      append(value: string) {
        output.append(`[${prefix}] ${value}`)
      },

      appendLine(value: string) {
        output.appendLine(`[${prefix}] ${value}`)
      }
    }
  }

  function promote(prefixPath: Array<string>, output: vscode.OutputChannel): IHierarchicalOutputChannel {
    return {
      ...output,
      prefixPath,

      local(prefix) {
        // this part was a PITA to figure out :-p
        return promote([...prefixPath, prefix], addPrefix(output, prefix))
      },

      split() {
        const name = [output.name, ...prefixPath].join('-')
        output.appendLine(alloglot.ui.splittingOutputChannel(name))
        return makeNoTimestamps(name)
      }
    }
  }
}
