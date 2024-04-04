import * as vscode from 'vscode'

import { alloglot } from './config'
import { AsyncProcess, IHierarchicalOutputChannel } from './utils'

export function makeActivationCommand(parentOutput: IHierarchicalOutputChannel, command: string | undefined, reveal: boolean | undefined): vscode.Disposable {
  if (!command) return vscode.Disposable.from()
  const basedir = vscode.workspace.workspaceFolders?.[0].uri
  const output = parentOutput.split()
  reveal && output.show(true)

  const proc = AsyncProcess.exec({ output, command, basedir }, () => {
    parentOutput.appendLine(alloglot.ui.activateCommandDone(command))
  })

  return vscode.Disposable.from(proc.disposable, output)
}
