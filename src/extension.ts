import * as vscode from 'vscode'

import { makeAnnotations } from './annotations'
import { makeApiSearch } from './apisearch'
import { makeClient } from './client'
import { Config, LanguageConfig, alloglot } from './config'
import { makeFormatter } from './formatter'
import { makeTags } from './tags'
import { readFileSync, writeFile, writeFileSync } from 'fs'

export function activate(context: vscode.ExtensionContext): void {
  const settingsSection = vscode.workspace.getConfiguration(alloglot.root)
  const alloglotWorkspaceLanguages = getWorkspaceConfig('.vscode/alloglot.json');
  const alloglotVscodeLanguages = settingsSection.get<Array<LanguageConfig>>(alloglot.config.languages, [])
  const alloglotLanguages = alloglotVscodeLanguages.length === 0 ? alloglotWorkspaceLanguages : alloglotVscodeLanguages;

  const config: Config = {
    languages: alloglotLanguages
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

function getWorkspaceConfig(workspaceConfigPath: string): LanguageConfig[] {
  const workspaceFolders =  vscode.workspace.workspaceFolders?.map(folder => folder.uri)
    try {
      if (workspaceFolders && workspaceFolders.length > 0)
      {
        const fullPath = vscode.Uri.joinPath(workspaceFolders[0], workspaceConfigPath);
        return JSON.parse(readFileSync(fullPath.path,'utf-8')).languages;
      } else {
        return []
      }
    } catch (err){
      return []
    }
}

export function deactivate() { }
