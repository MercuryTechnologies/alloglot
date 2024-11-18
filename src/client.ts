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

  const clientChannel = output.split()

  const clientOptions = {
    documentSelector: [{ scheme: 'file', language: languageId }],
    synchronize: { configurationSection: alloglot.root },
    revealOutputChannelOn: lsp.RevealOutputChannelOn.Never,
    outputChannel: clientChannel,
    outputChannelName: clientChannel.name,
    workspaceFolder: vscode.workspace.workspaceFolders?.[0]
  }

  let client = new lsp.LanguageClient(
    clientChannel.name,
    clientChannel.name,
    serverOptions,
    clientOptions,
    false
  )

  output.appendLine(alloglot.ui.startingLanguageClient)
  client.start()
  output.appendLine(alloglot.ui.languageClientStarted)

  const inlayHintsProvider = vscode.languages.registerInlayHintsProvider(
    languageId,
    {
      provideInlayHints: async (document, range, token) => {
        try {
          const x: any = await client.sendRequest(new lsp.RequestType('textDocument/inlayHint'),
            {
              textDocument: client.code2ProtocolConverter.asTextDocumentIdentifier(document),
              range: client.code2ProtocolConverter.asRange(range)
            }
          )
          return token.isCancellationRequested ? [] : x.map(
            (hint: vscode.InlayHint) => new vscode.InlayHint(client.protocol2CodeConverter.asPosition(hint.position), hint.label))
        }
        catch (error) { return null }
      },
      resolveInlayHint: (hint, token) => null
    }
  )

  return vscode.Disposable.from(
    clientChannel,
    {
      dispose: () => {
        output.appendLine(alloglot.ui.stoppingLanguageClient)
        client.stop()
        output.appendLine(alloglot.ui.languageClientStopped)
      }
    }
    , inlayHintsProvider
  )
}
