import { exec } from 'child_process'
import * as vscode from 'vscode'

export interface IDisposal extends vscode.Disposable {
  insert(disposable: vscode.Disposable): void
}

export namespace Disposal {
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
    output: vscode.OutputChannel
    command: string
    basedir?: vscode.Uri
    stdin?: string
  }

  export function make<T>(spec: Spec, f: (stdout: string) => T): IAsyncProcess<T> {
    let controller: AbortController | undefined = new AbortController()
    const { signal } = controller

    const { output, command, basedir, stdin } = spec
    const cwd = basedir?.fsPath

    // giving this an `any` signature allows us to add a `dispose` method.
    // it's a little bit jank, but i don't know how else to do it.
    const asyncProc: any = new Promise((resolve, reject) => {
      output.appendLine(`Running '${command}' in '${cwd}'...`)

      const proc = exec(command, { cwd, signal }, (error, stdout, stderr) => {
        if (error) {
          output.appendLine(`Error running '${command}':\n\t${error}`)
          reject(error)
        }

        stderr && output.appendLine(`Logs from '${command}':\n\t${stderr}`)
        !stdout && output.appendLine(`Received no output from '${command}'.`)

        resolve(f(stdout))
      })

      stdin && proc.stdin?.write(stdin)
      proc.stdin?.end()
      output.appendLine(`Ran '${command}'.`)
    })

    asyncProc.dispose = () => {
      if (controller) {
        output.appendLine(`Killing '${command}'...`)
        controller.abort()
        controller = undefined // ensure that `dispose()` is idempotent
        output.appendLine(`Killed '${command}'.`)
      }
    }

    return asyncProc as IAsyncProcess<T>
  }
}

export interface IHierarchicalOutputChannel extends vscode.OutputChannel {
  prefixPath: Array<string>
  local(prefix: string): IHierarchicalOutputChannel
}

export namespace HierarchicalOutputChannel {
  export function make(name: string): IHierarchicalOutputChannel {
    return promote([], vscode.window.createOutputChannel(name))
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
      }
    }
  }
}
