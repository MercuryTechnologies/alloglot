import * as vscode from 'vscode'

import { alloglot } from './config'
import { AsyncProcess, IHierarchicalOutputChannel } from './utils'

export function makeActivationCommand(parentOutput: IHierarchicalOutputChannel, command: string | undefined, reveal: boolean | undefined): vscode.Disposable {
  if (!command) return vscode.Disposable.from()
  const basedir = vscode.workspace.workspaceFolders?.[0].uri
  const output = parentOutput.split()
  reveal && output.show(true)

  const proc = AsyncProcess.spawn({ output, command, basedir })

  proc.then(() => () => {
    parentOutput.appendLine(alloglot.ui.activateCommandDone(command))
  })

  proc.catch(err => {
    vscode.window
      .showErrorMessage<'Ignore' | 'Restart'>(alloglot.ui.activateCommandFailed(err), 'Ignore', 'Restart')
      .then(choice => choice === 'Restart' && vscode.commands.executeCommand(alloglot.commands.restart))
  })

  return vscode.Disposable.from(proc, output)
}
