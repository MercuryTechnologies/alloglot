// do I even need this file???
// maybe this goes in the client. 


import * as vscode from 'vscode'

import { LanguageConfig, alloglot } from './config'
import { AsyncProcess, Disposal } from './utils'


export function makeInlayHintsProvider(output: vscode.OutputChannel, config: LanguageConfig): vscode.Disposable {
    const { languageId, inlayHints } = config
    if (!languageId || !inlayHints) return vscode.Disposable.from()
  
    const disposal = Disposal.make()
    const basedir = vscode.workspace.workspaceFolders?.[0].uri
    output.appendLine(alloglot.ui.registeringOnSaveCommand)
  


    output.appendLine(alloglot.ui.registeredOnSaveCommand)
  
    return vscode.Disposable.from(
      disposal)
  }
  