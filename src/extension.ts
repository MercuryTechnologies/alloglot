import * as vscode from 'vscode'

import { makeAnnotations } from './annotations'
import { makeApiSearch } from './apisearch'
import { Config, alloglot } from './config'
import { makeFormatter } from './formatter'

export function activate(context: vscode.ExtensionContext) {
  initializeMetafeatures(context, initializeFeatures(context))
}

function initializeFeatures(context: vscode.ExtensionContext): vscode.Disposable {
  const config: Config = (() => {
    const settings = vscode.workspace.getConfiguration(alloglot.root)
    const startCommand = settings.get<Config['startCommand']>(alloglot.config.startCommand, '')
    const stopCommand = settings.get<Config['stopCommand']>(alloglot.config.stopCommand, '')
    const languages = settings.get<Config['languages']>(alloglot.config.languages, [])
    return { startCommand, stopCommand, languages }
  })()

  const features = vscode.Disposable.from(
    makeApiSearch(config),
    ...config.languages.map(makeAnnotations),
    ...config.languages.map(makeFormatter)
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

  return metafeatures
}

export function deactivate() { }
