import * as vscode from 'vscode'

import { makeAnnotations } from './annotations'
import { makeApiSearch } from './apisearch'
import { makeClient } from './client'
import { Config, alloglot } from './config'
import { makeFormatter } from './formatter'
import { makeTags } from './tags'
import { AsyncProcess, HierarchicalOutputChannel, IHierarchicalOutputChannel } from './utils'

let globalOutput: vscode.OutputChannel | undefined
let globalContext: vscode.ExtensionContext | undefined

export function activate(context: vscode.ExtensionContext): void {
  if (globalOutput) {
    globalOutput.dispose()
    globalOutput = undefined
  }

  globalContext = context
  const output = HierarchicalOutputChannel.make(alloglot.root)
  globalOutput = output
  output.show(true)

  output.appendLine(alloglot.ui.startingAlloglot)
  const config = Config.make(output)
  output.appendLine(alloglot.ui.usingConfig(config))

  const langs = config.languages || []

  context.subscriptions.push(
    // Start the activation command if it's configured.
    makeActivationCommand(output.local(alloglot.components.activateCommand), config.activateCommand),
    // Make a single API search command because VSCode can't dynamically create commands.
    makeApiSearch(output.local(alloglot.components.apiSearch), config),
    ...langs.map(lang => makeAnnotations(output.local(`${alloglot.components.annotations}-${lang.languageId}`), lang)),
    ...langs.map(lang => makeFormatter(output.local(`${alloglot.components.formatter}-${lang.languageId}`), lang)),
    ...langs.map(lang => makeClient(output.local(`${alloglot.components.client}-${lang.languageId}`), lang)),
    ...langs.map(lang => makeTags(output.local(`${alloglot.components.tags}-${lang.languageId}`), lang)),
    // Restart the extension when the configuration changes.
    vscode.workspace.onDidChangeConfiguration(ev => ev.affectsConfiguration(alloglot.config.root) && restart(output, context)),
    // Restart the extension when the user runs the restart command.
    vscode.commands.registerCommand(alloglot.commands.restart, () => restart(output, context)),
  )
}

export function deactivate() {
  disposeAll(globalOutput, globalContext)
}

function disposeAll(output?: vscode.OutputChannel, context?: vscode.ExtensionContext) {
  output && output.appendLine(alloglot.ui.disposingAlloglot)
  context?.subscriptions.forEach(sub => sub.dispose())
}

function restart(output?: vscode.OutputChannel, context?: vscode.ExtensionContext) {
  output && output.appendLine(alloglot.ui.restartingAlloglot)
  disposeAll(output, context)
  context && activate(context)
}

function makeActivationCommand(output: IHierarchicalOutputChannel, command: string | undefined): vscode.Disposable {
  if (!command) return vscode.Disposable.from()
  const basedir = vscode.workspace.workspaceFolders?.[0].uri
  return AsyncProcess.make({ output: output.split(), command, basedir }, () => output.appendLine(alloglot.ui.activateCommandDone(command)))
}
