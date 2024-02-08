import * as vscode from 'vscode'

import { makeAnnotations } from './annotations'
import { makeApiSearch } from './apisearch'
import { Config, LanguageConfig, alloglot } from './config'
import { makeFormatter } from './formatter'
import { makeClient } from './client'

export function activate(context: vscode.ExtensionContext): void {
  const settingsSection = vscode.workspace.getConfiguration(alloglot.root)

  const config: Config = {
    languages: settingsSection
      .get<Array<LanguageConfig>>(alloglot.config.languages, [])
      // make sure no fields are whitespace-only
      // we mutate the original object because typescript doesn't have a `filterMap` function
      .filter(lang => {
        lang.languageId = lang.languageId.trim()
        lang.serverCommand = lang.serverCommand?.trim()
        lang.formatCommand = lang.formatCommand?.trim()
        lang.apiSearchUrl = lang.apiSearchUrl?.trim()
        lang.annotations = lang.annotations?.filter(ann => {
          ann.file = ann.file.trim()
          return ann.file
        })
        lang.tags = lang.tags?.filter(tag => {
          tag.file = tag.file.trim()
          return tag.file
        })
        return lang.languageId
      })
  }

  context.subscriptions.push(
    // Make a single API search command because VSCode can't dynamically create commands.
    makeApiSearch(config),
    // But we can dynamically create diagnostics sets...
    ...config.languages.map(makeAnnotations),
    // ...dynamically register language formatting providers...
    ...config.languages.map(makeFormatter),
    // ...and dynamically create LSP clients.
    ...config.languages.map(makeClient)
  )
}

export function deactivate() { }
