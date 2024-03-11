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
  globalContext = context
  const output = HierarchicalOutputChannel.make(alloglot.root)
  globalOutput = output

  output.appendLine(alloglot.ui.startingAlloglot)
  const config = Config.make(output)
  globalConfig = config
  output.appendLine(alloglot.ui.usingConfig(config))

  const langs = config.languages || []

  const verboseOutput = !!config.verboseOutput

  context.subscriptions.push(
    // Start the activation command if it's configured.
    makeActivationCommand(output.local(alloglot.components.activateCommand), config.activateCommand),
    // Make a single API search command because VSCode can't dynamically create commands.
    makeApiSearch(output.local(alloglot.components.apiSearch), config),
    ...langs.map(lang => makeAnnotations(output.local(`${alloglot.components.annotations}-${lang.languageId}`), lang)),
    ...langs.map(lang => makeFormatter(output.local(`${alloglot.components.formatter}-${lang.languageId}`), lang, verboseOutput)),
    ...langs.map(lang => makeClient(output.local(`${alloglot.components.client}-${lang.languageId}`), lang)),
    ...langs.map(lang => makeTags(output.local(`${alloglot.components.tags}-${lang.languageId}`), lang, verboseOutput)),
    // Restart the extension when the configuration changes.
    vscode.workspace.onDidChangeConfiguration(ev => ev.affectsConfiguration(alloglot.config.root) && restart()),
    // Restart the extension when the user runs the restart command.
    vscode.commands.registerCommand(alloglot.commands.restart, () => restart())
  )
}

export function deactivate(): void {
  const command = globalConfig?.deactivateCommand
  const basedir = vscode.workspace.workspaceFolders?.[0].uri

  function cleanup(): void {
    globalOutput?.appendLine(alloglot.ui.deactivatingAlloglot)
    globalContext && globalContext.subscriptions.forEach(sub => sub.dispose())
    globalOutput?.dispose()
    globalOutput = undefined
    globalConfig = undefined
  }

  if (command) {
    const proc = AsyncProcess.make({ output: globalOutput, command, basedir }, () => { })

    proc.then(() => {
      globalOutput?.appendLine(alloglot.ui.deactivateCommandDone(command))
      cleanup()
      proc.dispose()
    })

    proc.catch(err => {
      globalOutput?.appendLine(alloglot.ui.deactivateCommandFailed(err))
      cleanup()
      proc.dispose()
    })

  } else {
    cleanup()
  }
}

function restart(): void {
  globalOutput && globalOutput.appendLine(alloglot.ui.restartingAlloglot)
  deactivate()
  globalContext && activate(globalContext)
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
