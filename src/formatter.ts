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
import * as vscode from 'vscode'

import { LanguageConfig } from './config'
import { AsyncProcess, Disposal, IHierarchicalOutputChannel } from './utils'

/**
 * Register a custom document formatter for a language.
 */
export function makeFormatter(output: IHierarchicalOutputChannel, config: LanguageConfig): vscode.Disposable {
  const { languageId, formatCommand } = config
  if (!languageId || !formatCommand) return vscode.Disposable.from()

  output.appendLine('Starting formatter...')

  const disposal = Disposal.make()

  const formatter = vscode.languages.registerDocumentFormattingEditProvider(
    languageId,
    {
      provideDocumentFormattingEdits: document => {
        const command = formatCommand.replace('${file}', document.fileName)
        const basedir = vscode.workspace.workspaceFolders?.[0].uri
        const stdin = document.getText()
        const entireDocument = new vscode.Range(
          document.lineAt(0).range.start,
          document.lineAt(document.lineCount - 1).rangeIncludingLineBreak.end,
        );

        const proc = AsyncProcess.make({ output, command, basedir, stdin }, stdout => [new vscode.TextEdit(entireDocument, stdout)])
        disposal.insert(proc)
        return proc
      }
    }
  )

  output.appendLine('Formatter started.')

  return vscode.Disposable.from(
    formatter,
    disposal
  )
}
