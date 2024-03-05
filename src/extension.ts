import * as vscode from 'vscode'

import { makeAnnotations } from './annotations'
import { makeApiSearch } from './apisearch'
import { makeClient } from './client'
import { Config, HierarchicalOutputChannel, alloglot } from './config'
import { makeFormatter } from './formatter'
import { makeTags } from './tags'

let globalOutput: vscode.OutputChannel | undefined
let globalContext: vscode.ExtensionContext | undefined

export function activate(context: vscode.ExtensionContext): void {
  globalContext = context
  const output = HierarchicalOutputChannel.make(alloglot.root)
  output.appendLine('Starting Alloglot...')
  globalOutput = output
  const config = Config.create()
  output.appendLine(`Loaded configuration:\n${JSON.stringify(config, null, 2)}`)

  context.subscriptions.push(
    output,
    // Make a single API search command because VSCode can't dynamically create commands.
    makeApiSearch(output.local(alloglot.components.apiSearch), config),
    // But we can dynamically create diagnostics sets...
    ...config.languages.map(lang => makeAnnotations(output.local(alloglot.components.annotations).local(lang.languageId), lang)),
    // ...dynamically register language formatting providers...
    ...config.languages.map(lang => makeFormatter(output.local(alloglot.components.formatter).local(lang.languageId), lang)),
    // ...dynamically create LSP clients
    ...config.languages.map(lang => makeClient(output.local(alloglot.components.client).local(lang.languageId), lang)),
    // ...and dynamically create completions, definitions, and code actions providers.
    ...config.languages.map(lang => makeTags(output.local(alloglot.components.tags).local(lang.languageId), lang)),
    // restart extension when config changes
    vscode.workspace.onDidChangeConfiguration(ev => {
      if (ev.affectsConfiguration(alloglot.config.root)) restart(output, context)
    }),
    // user command to restart extension
    vscode.commands.registerCommand(alloglot.commands.restart, () => restart(output, context)),
  )
}

export function deactivate() {
  disposeAll(globalOutput, globalContext)
}

function disposeAll(output?: vscode.OutputChannel, context?: vscode.ExtensionContext) {
  output && output.appendLine('Disposing Alloglot...')
  context?.subscriptions.forEach(sub => sub.dispose())
}

function restart(output?: vscode.OutputChannel, context?: vscode.ExtensionContext) {
  output && output.appendLine('Restarting Alloglot...')
  disposeAll(output, context)
  context && activate(context)
}
