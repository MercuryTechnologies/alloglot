import { exec } from 'child_process'
import * as vscode from 'vscode'

interface AsyncProcess<T> extends vscode.Disposable, Promise<T> { }

export namespace AsyncProcess {
  type Spec = {
    output: vscode.OutputChannel
    command: string
    basedir?: vscode.Uri
    stdin?: string
  }

  export function make<T>(spec: Spec, f: (stdout: string) => T): AsyncProcess<T> {
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

    asyncProc['dispose'] = () => {
      // ensure that calling `dispose()` a second time is a no-op
      if (controller) {
        output.appendLine(`Killing '${command}'...`)
        controller.abort()
        controller = undefined
        output.appendLine(`Killed '${command}'.`)
      }
    }

    return asyncProc as AsyncProcess<T>
  }
}

export interface HierarchicalOutputChannel extends vscode.OutputChannel {
  prefixPath: Array<string>
  local(prefix: string): HierarchicalOutputChannel
}

export namespace HierarchicalOutputChannel {
  export function make(name: string): HierarchicalOutputChannel {
    return promote([], vscode.window.createOutputChannel(name))
  }

  function addPrefix(output: vscode.OutputChannel, prefix: string): vscode.OutputChannel {
    return {
      ...output,
      append: (value: string) => output.append(`[${prefix}] ${value}`),
      appendLine: (value: string) => output.appendLine(`[${prefix}] ${value}`)
    }
  }

  function promote(prefixPath: Array<string>, output: vscode.OutputChannel): HierarchicalOutputChannel {
    return {
      ...output,
      prefixPath,
      local: (prefix: string) => promote([...prefixPath, prefix], addPrefix(output, prefix)) // this part was a PITA to figure out :-p
    }
  }
}
