import * as vscode from 'vscode'

import { makeAnnotations } from './annotations'
import { makeApiSearch } from './apisearch'
import { makeClient } from './client'
import { Config, TConfig, alloglot } from './config'
import { makeFormatter } from './formatter'
import { makeTags } from './tags'
import { AsyncProcess, HierarchicalOutputChannel, IHierarchicalOutputChannel } from './utils'

let globalOutput: vscode.OutputChannel | undefined
let globalContext: vscode.ExtensionContext | undefined
let globalConfig: TConfig | undefined

export function activate(context: vscode.ExtensionContext): void {
  if (globalOutput) {
    globalOutput.dispose()
    globalOutput = undefined
  }

  globalContext = context
  const output = HierarchicalOutputChannel.make(alloglot.root)
  globalOutput = output

  output.appendLine(alloglot.ui.startingAlloglot)
  const config = Config.make(output)
  globalConfig = config
  output.appendLine(alloglot.ui.usingConfig(config))

  const langs = config.languages || []

  const verboseOutput = !!config.verboseOutput
  const grepPath = config.grepPath || 'grep'

  context.subscriptions.push(
    // Restart the extension when the user runs the restart command.
    vscode.commands.registerCommand(alloglot.commands.restart, () => restart(output, context)),

    // Restart the extension when the configuration changes.
    vscode.workspace.onDidChangeConfiguration(ev => ev.affectsConfiguration(alloglot.config.root) && restart(output, context)),

    // Start the activation component if it's configured.
    makeActivationCommand(output.local(alloglot.components.activateCommand), config.activateCommand),

    // Start the API search component because VSCode can't dynamically create commands.
    makeApiSearch(output.local(alloglot.components.apiSearch), config),

    // Start all the language-specific components.
    ...langs.map(lang => makeAnnotations(output.local(alloglot.components.annotations).local(lang.languageId), lang)),
    ...langs.map(lang => makeFormatter(output.local(alloglot.components.formatter).local(lang.languageId), lang, verboseOutput)),
    ...langs.map(lang => makeClient(output.local(alloglot.components.client).local(lang.languageId), lang)),
    ...langs.map(lang => makeTags(output.local(alloglot.components.tags).local(lang.languageId), grepPath, lang, verboseOutput))
  )
}

export function deactivate(): void {
  const command = globalConfig?.deactivateCommand
  globalConfig = undefined
  const basedir = vscode.workspace.workspaceFolders?.[0].uri

  function cleanup(): void {
    globalOutput?.appendLine(alloglot.ui.deactivatingAlloglot)
    globalContext && globalContext.subscriptions.forEach(sub => sub.dispose())
    globalContext = undefined
  }

  if (command) {
    const proc = AsyncProcess.make({ output: globalOutput, command, basedir }, () => { })

    proc.then(() => {
      globalOutput?.appendLine(alloglot.ui.deactivateCommandDone(command))
      cleanup()
    })

    proc.catch(err => {
      globalOutput?.appendLine(alloglot.ui.deactivateCommandFailed(err))
      cleanup()
    })

  } else {
    cleanup()
  }
}

function restart(output: vscode.OutputChannel, context: vscode.ExtensionContext): void {
  output.appendLine(alloglot.ui.restartingAlloglot)
  deactivate()
  activate(context)
}

function makeActivationCommand(parentOutput: IHierarchicalOutputChannel, command: string | undefined): vscode.Disposable {
  if (!command) return vscode.Disposable.from()
  const basedir = vscode.workspace.workspaceFolders?.[0].uri
  const output = parentOutput.split()

  const proc = AsyncProcess.make({ output, command, basedir }, () => {
    parentOutput.appendLine(alloglot.ui.activateCommandDone(command))
  })

  return vscode.Disposable.from(proc, output)
}
