import * as vscode from 'vscode'
import * as lsp from 'vscode-languageclient/node'

import { LanguageConfig, alloglot } from './config'
import { IHierarchicalOutputChannel } from './utils'

/**
 * A full-featured generic LSP client.
 * The client launches its own server in a child process and cleans up after itself.
 */
export function makeClient(output: IHierarchicalOutputChannel, config: LanguageConfig): vscode.Disposable {
  const { languageId, serverCommand } = config
  if (!languageId || !serverCommand) return vscode.Disposable.from()

  const serverExecutable = {
    command: serverCommand,
    options: {
      cwd: vscode.workspace.workspaceFolders?.[0].uri.fsPath,
      env: process.env
    },
    args: [],
    transport: lsp.TransportKind.stdio
  }

  const serverOptions = {
    run: serverExecutable,
    debug: serverExecutable
  }

  const clientId = `${alloglot.root}-${output.prefixPath.join('-')}`

  const clientOptions = {
    documentSelector: [{ scheme: 'file', language: languageId }],
    synchronize: { configurationSection: alloglot.root },
    revealOutputChannelOn: lsp.RevealOutputChannelOn.Never,
    outputChannel: vscode.window.createOutputChannel(clientId),
    outputChannelName: clientId,
    workspaceFolder: vscode.workspace.workspaceFolders?.[0]
  }

  let client = new lsp.LanguageClient(
    clientId,
    `${alloglot.root}-${languageId}`,
    serverOptions,
    clientOptions,
    false
  )

  output.appendLine(alloglot.ui.startingLanguageClient)
  client.start()
  output.appendLine(alloglot.ui.languageClientStarted)

  return vscode.Disposable.from(
    {
      dispose: () => {
        output.appendLine(alloglot.ui.stoppingLanguageClient)
        client.stop()
        output.appendLine(alloglot.ui.languageClientStopped)
      }
    }
  )
}
