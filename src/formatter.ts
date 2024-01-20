import { exec } from 'child_process'
import * as vscode from 'vscode'

import { Config, Elem } from "./config";

export function makeFormatter(config: Elem<Config['languages']>): vscode.Disposable {
  if (!config.formatCommand) return { dispose: () => { } }

  return vscode.languages.registerDocumentFormattingEditProvider(
    config.languageId,
    {
      provideDocumentFormattingEdits: document => {
        const command = config.formatCommand.replace('${file}', document.fileName)
        const cwd = getWorkspaceFolder(document)
        const documentText = document.getText();
        const entireDocument = new vscode.Range(
          document.lineAt(0).range.start,
          document.lineAt(document.lineCount - 1).rangeIncludingLineBreak.end,
        );

        return new Promise<Array<vscode.TextEdit>>((resolve, reject) => {
          const proc = exec(command, { cwd }, (error, stdout, stderr) => {
            if (error) reject(error)
            else if (stderr) reject(stderr)
            else if (!stdout) resolve([])
            else resolve([new vscode.TextEdit(entireDocument, stdout)])
          })

          proc.stdin?.write(documentText)
          proc.stdin?.end()
        })
      }
    }
  )
}

function getWorkspaceFolder(document: vscode.TextDocument): string | undefined {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri)
  const backupFolder = vscode.workspace.workspaceFolders?.[0]
  return workspaceFolder?.uri?.fsPath || backupFolder?.uri.fsPath
}
