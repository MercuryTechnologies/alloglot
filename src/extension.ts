import * as vscode from 'vscode'

import { makeActivationCommand } from './activationcommand'
import { makeAnnotations } from './annotations'
import { makeApiSearch } from './apisearch'
import { makeClient } from './client'
import { Config, alloglot } from './config'
import { makeFormatter } from './formatter'
import { makeOnSaveRunner } from './onsaverunner'
import { makeTags } from './tags'
import { HierarchicalOutputChannel, Disposal, IDisposal } from './utils'

// Global disposal to track all disposables for proper cleanup
let globalDisposal: IDisposal | undefined

export function activate(context: vscode.ExtensionContext): void {
  // Create a new global disposal for this activation
  globalDisposal = Disposal.make()
  console.log('Alloglot: Created global disposal for resource tracking')
  
  const output = HierarchicalOutputChannel.make(alloglot.root)

  output.appendLine(alloglot.ui.startingAlloglot)
  const config = Config.make(output)
  output.appendLine(alloglot.ui.usingConfig(config))

  const langs = config.languages || []

  const verboseOutput = !!config.verboseOutput
  const grepPath = config.grepPath || 'grep'

  // Create all disposables and add them to both context subscriptions and global disposal
  const disposables = [
    // Start the activation component if it's configured.
    makeActivationCommand(output.local(alloglot.components.activateCommand), config.activateCommand, config.revealActivateCommandOutput),

    // Start the API search component because VSCode can't dynamically create commands.
    makeApiSearch(output.local(alloglot.components.apiSearch), config),

    // Start all the language-specific components.
    ...langs.map(lang => makeOnSaveRunner(output.local(alloglot.components.onSaveRunner).local(lang.languageId), lang)),
    ...langs.map(lang => makeAnnotations(output.local(alloglot.components.annotations).local(lang.languageId), lang)),
    ...langs.map(lang => makeFormatter(output.local(alloglot.components.formatter).local(lang.languageId), lang, verboseOutput)),
    ...langs.map(lang => makeClient(output.local(alloglot.components.client).local(lang.languageId), lang)),
    ...langs.map(lang => makeTags(output.local(alloglot.components.tags).local(lang.languageId), grepPath, lang, verboseOutput))
  ]

  // Add all disposables to both the context and global disposal
  disposables.forEach(disposable => {
    context.subscriptions.push(disposable)
    globalDisposal?.insert(disposable)
  })

  // Add the output channel to global disposal
  globalDisposal?.insert(output)
  
  console.log(`Alloglot: Added ${disposables.length + 1} disposables to global disposal`)
}

export function deactivate(): void {
  // This function is called when the extension is deactivated
  // Perform explicit cleanup of all resources
  console.log(alloglot.ui.deactivatingAlloglot)
  
  if (globalDisposal) {
    try {
      console.log('Alloglot: Starting cleanup of all resources...')
      globalDisposal.dispose()
      globalDisposal = undefined
      console.log('Alloglot: All resources cleaned up successfully')
    } catch (error) {
      console.error('Alloglot: Error during cleanup:', error)
    }
  } else {
    console.log('Alloglot: No global disposal found to clean up')
  }
}
