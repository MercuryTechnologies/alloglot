import * as vscode from 'vscode'
import * as lsp from 'vscode-languageclient/node'

import { LanguageConfig, alloglot } from './config'

/**
 * A full-featured generic LSP client.
 * The client launches its own server in a child process and cleans up after itself.
 */
export function makeClient(config: LanguageConfig): vscode.Disposable {
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

  const clientId = `${alloglot.root}-${languageId}-client`
  const output = vscode.window.createOutputChannel(clientId)

  const clientOptions = {
    documentSelector: [{ scheme: 'file', language: languageId }],
    synchronize: { configurationSection: alloglot.root },
    revealOutputChannelOn: lsp.RevealOutputChannelOn.Never,
    outputChannel: output,
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

  output.append(`${alloglot.root}: Starting language client...\n`)
  client.start()
  output.append(`${alloglot.root}: Language client started.\n`)

  return vscode.Disposable.from(
    {
      dispose: () => {
        output.append(`${alloglot.root}: Stopping language client...\n`)
        client.stop()
        output.append(`${alloglot.root}: Language client stopped.\n`)
      }
    },
    output
  )
}
