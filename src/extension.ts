import * as vscode from 'vscode'

import { makeActivationCommand } from './activationcommand'
import { makeAnnotations } from './annotations'
import { makeApiSearch } from './apisearch'
import { makeClient } from './client'
import { Config, alloglot } from './config'
import { makeFormatter } from './formatter'
import { makeOnSaveRunner } from './onsaverunner'
import { makeTags } from './tags'
import { HierarchicalOutputChannel } from './utils'

export function activate(context: vscode.ExtensionContext): void {
  const output = HierarchicalOutputChannel.make(alloglot.root)

  output.appendLine(alloglot.ui.startingAlloglot)
  const config = Config.make(output)
  output.appendLine(alloglot.ui.usingConfig(config))

  const langs = config.languages || []

  const verboseOutput = !!config.verboseOutput
  const grepPath = config.grepPath || 'grep'

  context.subscriptions.push(
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
  )
}
