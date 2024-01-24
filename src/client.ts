import * as child_process from 'child_process'
import * as vscode from 'vscode'
import * as lsp from 'vscode-languageclient/node'

import { Config, Elem, alloglot } from './config'

export function makeClient(config: Elem<Config['languages']>): vscode.Disposable {
  if (!config.languageId || !config.serverCommand) return vscode.Disposable.from()

  const clientId = `${alloglot.root}-${config.languageId}`
  const output = vscode.window.createOutputChannel(clientId)
  const server = child_process.spawn(config.serverCommand, [], { env: process.env })

  const clientOptions = {
    documentSelector: [{ scheme: 'file', language: config.languageId }],
    synchronize: { configurationSection: alloglot.root },
    revealOutputChannelOn: lsp.RevealOutputChannelOn.Never,
    outputChannel: output,
    outputChannelName: clientId,
    workspaceFolder: vscode.workspace.workspaceFolders?.[0]
  }

  let client = new lsp.LanguageClient(
    clientId,
    `${alloglot.root} language client for ${config.languageId}`,
    () => Promise.resolve(server),
    clientOptions,
    false
  )

  client.start()

  return vscode.Disposable.from({
    dispose: () => {
      client.stop()
      server.kill()
      output.dispose()
    }
  })
}
