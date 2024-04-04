import * as vscode from 'vscode'

import { LanguageConfig, alloglot } from './config'
import { AsyncProcess, Disposal } from './utils'

export function makeOnSaveRunner(output: vscode.OutputChannel, config: LanguageConfig): vscode.Disposable {
  const { languageId, onSaveCommand } = config
  if (!languageId || !onSaveCommand) return vscode.Disposable.from()

  const disposal = Disposal.make()
  const basedir = vscode.workspace.workspaceFolders?.[0].uri
  output.appendLine(alloglot.ui.registeringOnSaveCommand)

  const onSaveWatcher = (() => {
    if (!onSaveCommand) return vscode.Disposable.from()

    const refreshTags = (doc: vscode.TextDocument) => {
      if (doc.languageId === languageId) {
        const command = onSaveCommand.replace('${file}', doc.fileName)
        disposal.insert(AsyncProcess.exec({ output, command, basedir }, () => undefined).disposable)
      }
    }

    return vscode.workspace.onDidSaveTextDocument(refreshTags)
  })()

  output.appendLine(alloglot.ui.registeredOnSaveCommand)

  return vscode.Disposable.from(
    disposal,
    onSaveWatcher
  )
}
