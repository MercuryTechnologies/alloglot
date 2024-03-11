import * as vscode from 'vscode'

import { LanguageConfig, StringTransformation, alloglot } from './config'
import { AsyncProcess, Disposal, IAsyncProcess, IHierarchicalOutputChannel } from './utils'

export function makeTags(output: IHierarchicalOutputChannel, config: LanguageConfig, verboseOutput: boolean): vscode.Disposable {
  const { languageId, tags } = config
  if (!languageId || !tags) return vscode.Disposable.from()

  const { completionsProvider, definitionsProvider, importsProvider, initTagsCommand, refreshTagsCommand } = tags

  const basedir: vscode.Uri | undefined = vscode.workspace.workspaceFolders?.[0].uri
  const tagsUri: vscode.Uri | undefined = basedir && vscode.Uri.joinPath(basedir, tags.file)

  if (!basedir || !tagsUri) return vscode.Disposable.from()

  if (!completionsProvider && !definitionsProvider && !importsProvider) return vscode.Disposable.from()

  output.appendLine(alloglot.ui.startingTags)
  const tagsSourceOutput = verboseOutput ? output.local(alloglot.components.tagsSource).split() : undefined
  const tagsSource = TagsSource.make({ languageId, basedir, tagsUri, output: tagsSourceOutput, initTagsCommand, refreshTagsCommand })

  const disposal = Disposal.make()
  disposal.insert(tagsSource)
  tagsSourceOutput && disposal.insert(tagsSourceOutput)

  if (completionsProvider) {
    output.appendLine(alloglot.ui.registeringCompletionsProvider)

    function getCompletions(document: vscode.TextDocument, position: vscode.Position): Promise<Array<[vscode.CompletionItem, vscode.InlineCompletionItem]>> {
      const wordRange = document.getWordRangeAtPosition(position)
      if (!wordRange) return Promise.resolve([])
      return tagsSource
        .findPrefix(document.getText(wordRange), 500)
        .then(tags => tags
          .map(tag => tag.symbol)
          .filter((x, i, xs) => xs.indexOf(x) === i)
          .map(symbol => {
            const comp = new vscode.CompletionItem(symbol)
            const inlComp = new vscode.InlineCompletionItem(symbol, wordRange)
            return [comp, inlComp]
          })
        )
    }

    disposal.insert(vscode.languages.registerCompletionItemProvider(languageId, {
      provideCompletionItems: (doc, pos) => getCompletions(doc, pos).then(xs => xs.map(([x, _]) => x))
    }))
    disposal.insert(vscode.languages.registerInlineCompletionItemProvider(languageId, {
      provideInlineCompletionItems: (doc, pos) => getCompletions(doc, pos).then(xs => xs.map(([_, y]) => y))
    }))
    output.appendLine(alloglot.ui.registeredCompletionsProvider)
  }

  if (definitionsProvider) {
    output.appendLine(alloglot.ui.registeringDefinitionsProvider)
    disposal.insert(vscode.languages.registerDefinitionProvider(languageId, {
      provideDefinition: (document, position) => {
        const wordRange = document.getWordRangeAtPosition(position)
        if (!wordRange) return Promise.resolve([])
        return tagsSource
          .findExact(document.getText(wordRange))
          .then(tags => tags.map(tag => new vscode.Location(vscode.Uri.joinPath(basedir, tag.file), new vscode.Position(tag.lineNumber, 0))))
      }
    }))
    output.appendLine(alloglot.ui.registeredDefinitionsProvider)
  }

  if (importsProvider) {
    output.appendLine(alloglot.ui.registeringImportsProvider)
    const importsProviderOutput = verboseOutput ? output.local(alloglot.components.importsProvider).split() : undefined
    const { matchFromFilepath, importLinePattern, renderModuleName } = importsProvider

    function applyStringTransformation(cmd: StringTransformation, xs: Array<string>): Array<string> {
      importsProviderOutput?.appendLine(`Applying ${JSON.stringify(cmd)} to ${JSON.stringify(xs)}`)
      switch (cmd.tag) {
        case "replace":
          return xs.map(x => x.replace(new RegExp(cmd.from, 'g'), cmd.to))
        case 'split':
          return xs.flatMap(x => x.split(cmd.on))
        case 'join':
          return [xs.join(cmd.with)]
        case 'toUpper':
          return xs.map(x => x.toUpperCase())
        case 'toLower':
          return xs.map(x => x.toLowerCase())
        case 'capitalize':
          return xs.map(x => x.charAt(0).toUpperCase() + x.slice(1))
      }
    }

    function applyStringTransformations(cmds: Array<StringTransformation>, x: string): string {
      importsProviderOutput?.appendLine(alloglot.ui.applyingTransformations(cmds, x))
      let buffer = [x]
      cmds.forEach(cmd => buffer = applyStringTransformation(cmd, buffer))
      const result = buffer.join()
      importsProviderOutput?.appendLine(alloglot.ui.transformationResult(result))
      return result
    }

    function renderImportLine(tag: TagsSource.Tag): { renderedImport?: string, renderedModuleName?: string } {
      importsProviderOutput?.appendLine(alloglot.ui.renderingImportLine(tag))

      const fileMatcher = new RegExp(matchFromFilepath)
      importsProviderOutput?.appendLine(alloglot.ui.usingFileMatcher(fileMatcher))

      const match = tag.file.match(fileMatcher)
      importsProviderOutput?.appendLine(alloglot.ui.fileMatcherResult(match))

      const symbol = tag.symbol

      const renderedModuleName = match && match.length > 0
        ? applyStringTransformations(renderModuleName, match[0])
        : undefined
      importsProviderOutput?.appendLine(alloglot.ui.renderedModuleName(renderedModuleName))

      const renderedImport = renderedModuleName
        ? importLinePattern.replace('${module}', renderedModuleName).replace('${symbol}', symbol) + '\n'
        : undefined
      importsProviderOutput?.appendLine(alloglot.ui.renderedImportLine(renderedImport))

      return { renderedImport, renderedModuleName }
    }

    function findImportPosition(document: vscode.TextDocument): vscode.Position {
      importsProviderOutput?.appendLine(alloglot.ui.findingImportPosition)
      const importMatcher = new RegExp(importLinePattern.replace('${module}', '(.*)').replace('${symbol}', '(.*)'))
      const fullText = document.getText().split('\n')
      const firstImportLine = fullText.findIndex(line => line.match(importMatcher))
      if (firstImportLine >= 0) {
        importsProviderOutput?.appendLine(alloglot.ui.foundImportPosition(firstImportLine))
        return new vscode.Position(firstImportLine, 0)
      }
      const firstBlankLine = fullText.findIndex(line => line.match(/^\s*$/))
      if (firstBlankLine >= 0) {
        importsProviderOutput?.appendLine(alloglot.ui.foundBlankLine(firstBlankLine))
        return new vscode.Position(firstBlankLine, 0)
      }
      importsProviderOutput?.appendLine(alloglot.ui.noBlankLineFound)
      return new vscode.Position(0, 0)
    }

    function makeImportSuggestion(document: vscode.TextDocument, tag: TagsSource.Tag): ImportSuggestion | undefined {
      importsProviderOutput?.appendLine(alloglot.ui.makingImportSuggestion(tag))
      const { renderedImport, renderedModuleName } = renderImportLine(tag)
      if (!renderedImport || !renderedModuleName) return undefined
      const position = findImportPosition(document)
      const label = alloglot.ui.addImport(renderedModuleName)
      const edit = new vscode.WorkspaceEdit()
      edit.insert(document.uri, position, renderedImport)
      return { label, edit }
    }

    function getImportSuggestions(document: vscode.TextDocument, range: vscode.Range): Promise<Array<ImportSuggestion>> {
      return tagsSource.findExact(document.getText(range))
        .then(tags => tags.map(tag => makeImportSuggestion(document, tag)).filter(x => x) as Array<ImportSuggestion>)
    }

    function runSuggestImports(editor: vscode.TextEditor): void {
      importsProviderOutput?.appendLine(alloglot.ui.runningSuggestImports)
      const { document, selection } = editor
      const wordRange = document.getWordRangeAtPosition(selection.start)
      if (!wordRange) return undefined
      const suggestions = getImportSuggestions(document, wordRange).then(xs => {
        const uniqueModules = new Map<string, ImportSuggestion>(xs.map(x => [x.label, x]))
        return Array.from(uniqueModules.values())
      })
      vscode.window.showQuickPick<ImportSuggestion>(suggestions).then(pick => {
        importsProviderOutput?.appendLine(alloglot.ui.pickedSuggestion(pick))
        pick?.edit && vscode.workspace.applyEdit(pick.edit).then(success => {
          importsProviderOutput?.appendLine(alloglot.ui.appliedEdit(success))
        })
      })
    }

    disposal.insert(vscode.commands.registerTextEditorCommand(alloglot.commands.suggestImports, runSuggestImports))
    disposal.insert(vscode.languages.registerCodeActionsProvider(languageId, {
      provideCodeActions(document, range) {
        importsProviderOutput?.appendLine(alloglot.ui.providingCodeActions)
        return getImportSuggestions(document, range).then(xs => xs.map(x => {
          const action = new vscode.CodeAction(x.label, vscode.CodeActionKind.QuickFix)
          action.edit = x.edit
          return action
        }))
      }
    }))
    output.appendLine(alloglot.ui.registeredImportsProvider)
  }

  output.appendLine(alloglot.ui.tagsStarted)
  return disposal
}

type ImportSuggestion = {
  label: string
  edit: vscode.WorkspaceEdit
}

interface ITagsSource extends vscode.Disposable {
  findPrefix(prefix: string, limit?: number): Promise<Array<TagsSource.Tag>>
  findExact(exact: string, limit?: number): Promise<Array<TagsSource.Tag>>
}

namespace TagsSource {
  export type Tag = {
    symbol: string
    file: string
    lineNumber: number
  }

  export type Config = {
    languageId: string,
    basedir: vscode.Uri,
    tagsUri: vscode.Uri,
    output?: vscode.OutputChannel,
    initTagsCommand?: string,
    refreshTagsCommand?: string
  }

  export function make(config: Config): ITagsSource {
    const { languageId, basedir, tagsUri, output, initTagsCommand, refreshTagsCommand } = config
    output?.appendLine(alloglot.ui.creatingTagsSource(tagsUri.fsPath))

    const disposal = Disposal.make()

    if (initTagsCommand) {
      const command = initTagsCommand
      disposal.insert(AsyncProcess.make({ output, command, basedir }, () => undefined))
    }

    const onSaveWatcher = (() => {
      if (!refreshTagsCommand) return vscode.Disposable.from()

      const refreshTags = (doc: vscode.TextDocument) => {
        if (doc.languageId === languageId) {
          const command = refreshTagsCommand.replace('${file}', doc.fileName)
          disposal.insert(AsyncProcess.make({ output, command, basedir }, () => undefined))
        }
      }

      return vscode.workspace.onDidSaveTextDocument(refreshTags)
    })()

    return {
      findPrefix(prefix, limit = 100) {
        if (!prefix) return Promise.resolve([])
        const escaped = prefix.replace(/(["\s'$`\\])/g, '\\$1')
        const proc = grep(config, new RegExp(`^${escaped}`), limit, output)
        disposal.insert(proc)
        return proc
      },

      findExact(exact, limit = 100) {
        if (!exact) return Promise.resolve([])
        const escaped = exact.replace(/(["\s'$`\\])/g, '\\$1')
        const proc = grep(config, new RegExp(`^${escaped}\\t`), limit, output)
        disposal.insert(proc)
        return proc
      },

      dispose() {
        onSaveWatcher.dispose()
        disposal.dispose()
      }
    }
  }

  function grep(config: Config, regexp: RegExp, limit: number, output?: vscode.OutputChannel): IAsyncProcess<Array<Tag>> {
    const { tagsUri, basedir } = config
    const command = `grep -P '${regexp.source}' ${tagsUri.fsPath} | head -n ${limit}`

    output?.appendLine(`Searching for ${regexp} in ${tagsUri.fsPath}...`)
    return AsyncProcess.make({ output, command, basedir }, stdout => filterMap(stdout.split('\n'), line => parseTag(line, output)))
  }

  function parseTag(line: string, output?: vscode.OutputChannel): Tag | undefined {
    output?.appendLine(alloglot.ui.parsingTagLine(line))
    const [symbol, file, rawLineNumber] = line.split('\t')
    let lineNumber = parseInt(rawLineNumber)
    if (!symbol || !file || !lineNumber) return undefined
    const tag = { symbol, file, lineNumber }
    output?.appendLine(alloglot.ui.parsedTagLine(tag))
    return tag
  }

  function filterMap<T, U>(xs: Array<T>, f: (x: T) => U | undefined): Array<U> {
    const result: Array<U> = []
    for (const x of xs) {
      const y = f(x)
      if (y !== undefined) result.push(y)
    }
    return result
  }
}
