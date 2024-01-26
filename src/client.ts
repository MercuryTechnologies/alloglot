import * as child_process from 'child_process'
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

  const clientId = `${alloglot.root}-${languageId}`
  const output = vscode.window.createOutputChannel(clientId)

  const clientOptions = {
    documentSelector: [{ scheme: 'file', language: languageId }],
    synchronize: { configurationSection: alloglot.root },
    revealOutputChannelOn: lsp.RevealOutputChannelOn.Never,
    outputChannel: output,
    outputChannelName: clientId,
    workspaceFolder: vscode.workspace.workspaceFolders?.[0]
  }

  return utils.bracket<child_process.ChildProcessWithoutNullStreams, vscode.Disposable>({
    open: () => child_process.spawn(serverCommand, [], { env: process.env }),
    close: server => server.kill(),
    use: server => {
      return utils.bracket<lsp.LanguageClient, vscode.Disposable>({
        open: () => {
          let client = new lsp.LanguageClient(
            clientId,
            `${alloglot.root} language client for ${languageId}`,
            () => Promise.resolve(server),
            clientOptions,
            false
          )
          client.start()
          return client
        },
        close: client => client.stop(),
        use: client => {
          return vscode.Disposable.from({
            dispose: () => {
              client.stop()
              server.kill()
              output.dispose()
            }
          })
        }
      })
    }
  })
}

namespace utils {
  export function bracket<T, U>(args: { open: () => T, close: (t: T) => void, use: (t: T) => U }): U {
    let t: T | undefined = undefined
    try {
      t = args.open()
      return args.use(t)
    }
    finally {
      if (t) args.close(t)
    }
  }
}
