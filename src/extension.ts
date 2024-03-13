import * as vscode from 'vscode'

import { makeAnnotations } from './annotations'
import { makeApiSearch } from './apisearch'
import { makeClient } from './client'
import { Config, TConfig, alloglot } from './config'
import { makeFormatter } from './formatter'
import { makeOnSaveRunner } from './onsaverunner'
import { makeTags } from './tags'
import { AsyncProcess, HierarchicalOutputChannel, IHierarchicalOutputChannel } from './utils'

let globalOutput: IHierarchicalOutputChannel | undefined
let globalContext: vscode.ExtensionContext | undefined
let globalConfig: TConfig | undefined

export function activate(context: vscode.ExtensionContext): void {
  globalContext = context
  const output = globalOutput || HierarchicalOutputChannel.make(alloglot.root)
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
    ...langs.map(lang => makeOnSaveRunner(output.local(alloglot.components.onSaveRunner).local(lang.languageId), lang)),
    ...langs.map(lang => makeAnnotations(output.local(alloglot.components.annotations).local(lang.languageId), lang)),
    ...langs.map(lang => makeFormatter(output.local(alloglot.components.formatter).local(lang.languageId), lang, verboseOutput)),
    ...langs.map(lang => makeClient(output.local(alloglot.components.client).local(lang.languageId), lang)),
    ...langs.map(lang => makeTags(output.local(alloglot.components.tags).local(lang.languageId), grepPath, lang, verboseOutput))
  )
}

export function deactivate(): Promise<void> {
  const command = globalConfig?.deactivateCommand
  globalConfig = undefined
  const basedir = vscode.workspace.workspaceFolders?.[0].uri

  function cleanup(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        globalOutput?.appendLine(alloglot.ui.deactivatingAlloglot)
        globalContext && globalContext.subscriptions.forEach(sub => sub.dispose())
        globalContext = undefined
        globalOutput?.appendLine(alloglot.ui.deactivatedAlloglot)
        resolve()
      } catch (err) {
        reject(err)
      }
    })
  }

  if (command) {
    return AsyncProcess.make({ output: globalOutput, command, basedir }, () => undefined)
      .then(() => {
        globalOutput?.appendLine(alloglot.ui.deactivateCommandDone(command))
        return cleanup()
      })
      .catch(err => {
        globalOutput?.appendLine(alloglot.ui.deactivateCommandFailed(err))
        return cleanup()
      })
  } else {
    return cleanup()
  }
}

function restart(output: vscode.OutputChannel, context: vscode.ExtensionContext): void {
  output.appendLine(alloglot.ui.restartingAlloglot)
  deactivate().then(() => {
    output.appendLine(alloglot.ui.readyToRestart)
    activate(context)
  })
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
