import * as vscode from 'vscode'

import { makeAnnotations } from './annotations'
import { makeApiSearch } from './apisearch'
import { Config, alloglot } from './config'
import { makeFormatter } from './formatter'
import { makeClient } from './client'

export function activate(context: vscode.ExtensionContext) {
  initializeMetafeatures(context, initializeFeatures(context))
}

function initializeFeatures(context: vscode.ExtensionContext): vscode.Disposable {
  const config: Config = (() => {

    const settings = vscode.workspace.getConfiguration(alloglot.root)

    const languages = settings
      .get<Config['languages']>(alloglot.config.languages, [])
      .filter(lang => lang.languageId.trim())
      .map(lang => {
        return {
          languageId: lang.languageId.trim(),
          serverCommand: lang.serverCommand.trim(),
          formatCommand: lang.formatCommand.trim(),
          apiSearchUrl: lang.apiSearchUrl.trim(),
          annotationsFiles: lang.annotationsFiles.filter(x => x.trim()).map(x => x.trim())
        }
      })

    return { languages }
  })()

  const features = vscode.Disposable.from(
    makeApiSearch(config),
    ...config.languages.map(makeAnnotations),
    ...config.languages.map(makeFormatter),
    ...config.languages.map(makeClient)
  )

  context.subscriptions.push(features)

  return features
}

function initializeMetafeatures(context: vscode.ExtensionContext, features: vscode.Disposable): vscode.Disposable {
  const metafeatures = vscode.Disposable.from(
    vscode.workspace.onDidChangeConfiguration(event => {
      if (!event.affectsConfiguration(alloglot.root)) return
      features.dispose()
      initializeFeatures(context)
    }),
    vscode.commands.registerCommand(alloglot.commands.start, () => {
      features.dispose()
      initializeFeatures(context)
    }),
    vscode.commands.registerCommand(alloglot.commands.restart, () => {
      features.dispose()
      initializeFeatures(context)
    }),
    vscode.commands.registerCommand(alloglot.commands.stop, () => {
      features.dispose()
    })
  )

  context.subscriptions.push(metafeatures)

  return vscode.Disposable.from(features, metafeatures)
}

export function deactivate() { }
