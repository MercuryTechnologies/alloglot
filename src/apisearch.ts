import * as vscode from 'vscode'

import { Config, alloglot } from './config'

export function makeApiSearch(config: Config): vscode.Disposable {
  const langs: Map<string, string> = new Map()

  config.languages.forEach(lang => {
    lang.languageId && lang.apiSearchUrl && langs.set(lang.languageId, lang.apiSearchUrl)
  })

  return vscode.commands.registerTextEditorCommand(
    alloglot.commands.apiSearch,
    editor => {
      const wordRange = editor.document.getWordRangeAtPosition(editor.selection.start)
      const query =
        !editor.selection.isEmpty
          ? editor.document.getText(editor.selection.with())
          : wordRange
            ? editor.document.getText(wordRange)
            : ''

      const pattern = langs.get(editor.document.languageId)
      const url =
        pattern
          ? pattern.replace('${query}', encodeURI(query))
          : `https://www.google.com/search?q=${encodeURI(query)}`

      vscode.env.openExternal(vscode.Uri.parse(url))
    }
  )
}
