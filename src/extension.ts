import * as vscode from 'vscode'

import { makeAnnotations } from './annotations'
import { makeApiSearch } from './apisearch'
import { makeClient } from './client'
import { Config, alloglot } from './config'
import { makeFormatter } from './formatter'
import { makeTags } from './tags'

let globalContext: vscode.ExtensionContext | undefined

export function activate(context: vscode.ExtensionContext): void {
  globalContext = context
  const config = Config.create()

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
    ...config.languages.map(makeTags),
    // restart extension when config changes
    vscode.workspace.onDidChangeConfiguration(ev => {
      if (ev.affectsConfiguration(alloglot.config.root)) restart(context)
    }),
    // user command to restart extension
    vscode.commands.registerCommand(alloglot.commands.restart, () => restart(context)),
  )
}

export function deactivate() {
  globalContext && disposeAll(globalContext)
}

function disposeAll(context: vscode.ExtensionContext) {
  context.subscriptions.forEach(sub => sub.dispose())
}

function restart(context: vscode.ExtensionContext) {
  disposeAll(context)
  activate(context)
}
