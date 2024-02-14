import * as vscode from 'vscode'

import { makeAnnotations } from './annotations'
import { makeApiSearch } from './apisearch'
import { makeClient } from './client'
import { Config, LanguageConfig, alloglot } from './config'
import { makeFormatter } from './formatter'
import { makeTags } from './tags'

export function activate(context: vscode.ExtensionContext): void {
  const settingsSection = vscode.workspace.getConfiguration(alloglot.root)

  const config: Config = {
    languages: settingsSection
      .get<Array<LanguageConfig>>(alloglot.config.languages, [])
      .filter(lang => {
        // make sure no fields are whitespace-only
        // we mutate the original object because typescript doesn't have a `filterMap` function

        lang.languageId = lang.languageId.trim()
        lang.serverCommand = lang.serverCommand?.trim()
        lang.formatCommand = lang.formatCommand?.trim()
        lang.apiSearchUrl = lang.apiSearchUrl?.trim()

        lang.annotations = lang.annotations?.filter(ann => {
          ann.file = ann.file.trim()
          return ann.file
        })

        if (lang.tags) {
          lang.tags.file = lang.tags.file.trim()
          if (!lang.tags?.importsProvider?.importLinePattern.trim()) lang.tags.importsProvider = undefined
          if (!lang.tags?.importsProvider?.matchFromFilepath.trim()) lang.tags.importsProvider = undefined
          if (!lang.tags.file) lang.tags = undefined
        }

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
    // ...dynamically create LSP clients
    ...config.languages.map(makeClient),
    // ...and dynamically create completions, definitions, and code actions providers.
    ...config.languages.map(makeTags)
  )
}

export function deactivate() { }
