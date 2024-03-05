/*
Portions of this software are derived from [vscode-custom-local-formatters](https://github.com/JKillian/vscode-custom-local-formatters) and subject to the original authors licensing terms, reproduced below.

> MIT License
>
> Copyright (c) 2020 Jason Killian
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.
*/
import { exec } from 'child_process'
import * as vscode from 'vscode'

import { HierarchicalOutputChannel, LanguageConfig, alloglot } from "./config";

/**
 * Register a custom document formatter for a language.
 */
export function makeFormatter(output: HierarchicalOutputChannel, config: LanguageConfig): vscode.Disposable {
  const { languageId, formatCommand } = config
  if (!languageId || !formatCommand) return vscode.Disposable.from()

  output.appendLine('Starting formatter...')
  const formatter = vscode.languages.registerDocumentFormattingEditProvider(
    languageId,
    {
      provideDocumentFormattingEdits: document => {
        const command = formatCommand.replace('${file}', document.fileName)
        const cwd = utils.getWorkspaceFolder(document)
        const documentText = document.getText()
        const entireDocument = new vscode.Range(
          document.lineAt(0).range.start,
          document.lineAt(document.lineCount - 1).rangeIncludingLineBreak.end,
        );

        output.append(`Formatting document with:\n\tcommand=${command}\n\tcwd=${cwd}\n`)

        return new Promise<Array<vscode.TextEdit>>((resolve, reject) => {
          const proc = exec(command, { cwd }, (error, stdout, stderr) => {
            if (error) {
              output.append(`Error running formatter:\t${error}\n`)
              reject(error)
            }
            else if (!stdout) {
              output.append(`Formatter produced no output.\n`)
              resolve([])
            }
            else {
              stderr && output.append(`Formatter logs:\n${stderr}\n`)
              resolve([new vscode.TextEdit(entireDocument, stdout)])
            }
          })

          proc.stdin?.write(documentText)
          proc.stdin?.end()
        })
      }
    }
  )

  output.appendLine('Formatter started.')
  return formatter
}

namespace utils {
  export function getWorkspaceFolder(document: vscode.TextDocument): string | undefined {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri)
    const backupFolder = vscode.workspace.workspaceFolders?.[0]
    return workspaceFolder?.uri?.fsPath || backupFolder?.uri.fsPath
  }
}
