import { exec } from 'child_process'
import * as vscode from 'vscode'

import { LanguageConfig, StringTransformation, alloglot } from './config'

export function makeTags(config: LanguageConfig): vscode.Disposable {
  const { languageId, tags } = config
  if (!languageId || !tags) return vscode.Disposable.from()

  const { completionsProvider, definitionsProvider, importsProvider, initTagsCommand, refreshTagsCommand } = tags

  const basedir: vscode.Uri | undefined = vscode.workspace.workspaceFolders?.[0].uri
  const tagsUri: vscode.Uri | undefined = basedir && vscode.Uri.joinPath(basedir, tags.file)

  if (!basedir || !tagsUri) return vscode.Disposable.from()

  if (!completionsProvider && !definitionsProvider && !importsProvider) return vscode.Disposable.from()

  const clientId = `${alloglot.root}-${languageId}-tags`
  const output = vscode.window.createOutputChannel(clientId)
  output.appendLine(`${alloglot.root}: Starting tags for ${languageId}`)

  const tagsSource = TagsSource.make({ languageId, basedir, tagsUri, output, initTagsCommand, refreshTagsCommand })

  const disposables: Array<vscode.Disposable> = [tagsSource]

  if (completionsProvider) {
    output.appendLine('Registering completions provider...')

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

    disposables.push(
      vscode.languages.registerCompletionItemProvider(languageId, {
        provideCompletionItems: (doc, pos) => getCompletions(doc, pos).then(xs => xs.map(([x, _]) => x))
      }),
      vscode.languages.registerInlineCompletionItemProvider(languageId, {
        provideInlineCompletionItems: (doc, pos) => getCompletions(doc, pos).then(xs => xs.map(([_, y]) => y))
      })
    )

    output.appendLine('Registered completions provider.')
  }

  if (definitionsProvider) {
    output.appendLine('Registering definitions provider...')
    disposables.push(
      vscode.languages.registerDefinitionProvider(languageId, {
        provideDefinition: (document, position) => {
          const wordRange = document.getWordRangeAtPosition(position)
          if (!wordRange) return Promise.resolve([])
          return tagsSource
            .findExact(document.getText(wordRange))
            .then(tags => tags.map(tag => new vscode.Location(vscode.Uri.joinPath(basedir, tag.file), new vscode.Position(tag.lineNumber, 0))))
        }
      })
    )
    output.appendLine('Registered definitions provider.')
  }

  if (importsProvider) {
    output.appendLine('Registering imports provider...')
    const { matchFromFilepath, importLinePattern, renderModuleName } = importsProvider

    function applyStringTransformation(cmd: StringTransformation, xs: Array<string>): Array<string> {
      output.appendLine(`Applying ${JSON.stringify(cmd)} to ${JSON.stringify(xs)}`)
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
      output.appendLine(`Applying ${JSON.stringify(cmds)} to ${x}`)
      let result = [x]
      cmds.forEach(cmd => result = applyStringTransformation(cmd, result))
      output.appendLine(`Result: ${result.join()}`)
      return result.join()
    }

    function renderImportLine(tag: TagsSource.Tag): { renderedImport?: string, renderedModuleName?: string } {
      output.appendLine(`Rendering import line for ${JSON.stringify(tag)}`)

      const fileMatcher = new RegExp(matchFromFilepath)
      output.appendLine(`File matcher: ${fileMatcher}`)

      const match = tag.file.match(fileMatcher)
      output.appendLine(`Match: ${match}`)

      const symbol = tag.symbol

      const renderedModuleName = match && match.length > 0
        ? applyStringTransformations(renderModuleName, match[0])
        : undefined
      output.appendLine(`Rendered module name: ${renderedModuleName}`)

      const renderedImport = renderedModuleName
        ? importLinePattern.replace('${module}', renderedModuleName).replace('${symbol}', symbol) + '\n'
        : undefined
      output.appendLine(`Rendered import: ${renderedImport}`)

      return { renderedImport, renderedModuleName }
    }

    function findImportPosition(document: vscode.TextDocument): vscode.Position {
      output.appendLine('Finding import position...')
      const importMatcher = new RegExp(importLinePattern.replace('${module}', '(.*)').replace('${symbol}', '(.*)'))
      const fullText = document.getText().split('\n')
      const firstImportLine = fullText.findIndex(line => line.match(importMatcher))
      if (firstImportLine >= 0) {
        output.appendLine(`Found import at line ${firstImportLine}`)
        return new vscode.Position(firstImportLine, 0)
      }
      const firstBlankLine = fullText.findIndex(line => line.match(/^\s*$/))
      if (firstBlankLine >= 0) {
        output.appendLine(`Found blank line at line ${firstBlankLine}`)
        return new vscode.Position(firstBlankLine, 0)
      }
      output.appendLine('No blank line found, using start of file.')
      return new vscode.Position(0, 0)
    }

    function makeImportSuggestion(document: vscode.TextDocument, tag: TagsSource.Tag): ImportSuggestion | undefined {
      output.appendLine(`Making import suggestion for ${JSON.stringify(tag)}`)
      const { renderedImport, renderedModuleName } = renderImportLine(tag)
      if (!renderedImport || !renderedModuleName) return undefined
      const position = findImportPosition(document)
      const label = `Add import: ${renderedModuleName}`
      const edit = new vscode.WorkspaceEdit()
      edit.insert(document.uri, position, renderedImport)
      return { label, edit }
    }

    function getImportSuggestions(document: vscode.TextDocument, range: vscode.Range): Promise<Array<ImportSuggestion>> {
      return tagsSource.findExact(document.getText(range))
        .then(tags => tags.map(tag => makeImportSuggestion(document, tag)).filter(x => x) as Array<ImportSuggestion>)
    }

    function runSuggestImports(editor: vscode.TextEditor): void {
      output.appendLine('Running suggest imports...')
      const { document, selection } = editor
      const wordRange = document.getWordRangeAtPosition(selection.start)
      if (!wordRange) return undefined
      const suggestions = getImportSuggestions(document, wordRange).then(xs => {
        const uniqueModules = new Map<string, ImportSuggestion>(xs.map(x => [x.label, x]))
        return Array.from(uniqueModules.values())
      })
      vscode.window.showQuickPick<ImportSuggestion>(suggestions).then(pick => {
        output.appendLine(`Picked: ${JSON.stringify(pick)}`)
        pick?.edit && vscode.workspace.applyEdit(pick.edit).then(success => {
          output.appendLine(`Applied edit: ${success}`)
        })
      })
    }

    disposables.push(
      vscode.commands.registerTextEditorCommand(alloglot.commands.suggestImports, runSuggestImports),
      vscode.languages.registerCodeActionsProvider(languageId, {
        provideCodeActions(document, range) {
          output.appendLine('Providing code actions...')
          return getImportSuggestions(document, range).then(xs => xs.map(x => {
            const action = new vscode.CodeAction(x.label, vscode.CodeActionKind.QuickFix)
            action.edit = x.edit
            return action
          }))
        }
      })
    )
    output.appendLine('Registered imports provider.')
  }

  return vscode.Disposable.from(...disposables)
}

type ImportSuggestion = {
  label: string
  edit: vscode.WorkspaceEdit
}

type TagsSource = vscode.Disposable & {
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
    output: vscode.OutputChannel,
    initTagsCommand?: string,
    refreshTagsCommand?: string
  }

  export function make(config: Config): TagsSource {
    const { languageId, basedir, tagsUri, output, initTagsCommand, refreshTagsCommand } = config
    output.appendLine(`Creating tags source for ${tagsUri.fsPath}`)

    if (initTagsCommand) {
      output.appendLine('Initializing tags file...')
      asyncRunProc(output, initTagsCommand, basedir, () => undefined)
      output.appendLine('Tags file initialized.')
    }

    const onSaveWatcher = (() => {
      if (!refreshTagsCommand) return vscode.Disposable.from()

      const refreshTags = (doc: vscode.TextDocument) => {
        if (doc.languageId === languageId) {
          output.appendLine('Refreshing tags file...')
          asyncRunProc(output, refreshTagsCommand.replace('${file}', doc.fileName), basedir, () => undefined)
          output.appendLine('Tags file refreshed.')
        }
      }

      return vscode.workspace.onDidSaveTextDocument(refreshTags)
    })()

    return {
      findPrefix(prefix: string, limit: number = 100) {
        if (!prefix) return Promise.resolve([])
        const escaped = prefix.replace(/(["\s'$`\\])/g, '\\$1')
        return grep(config, output, new RegExp(`^${escaped}`), limit)
      },
      findExact(exact: string, limit: number = 100) {
        if (!exact) return Promise.resolve([])
        const escaped = exact.replace(/(["\s'$`\\])/g, '\\$1')
        return grep(config, output, new RegExp(`^${escaped}\\t`), limit)
      },
      dispose() {
        onSaveWatcher.dispose()
      }
    }
  }

  function grep(config: Config, output: vscode.OutputChannel, regexp: RegExp, limit: number): Promise<Array<Tag>> {
    const { tagsUri, basedir } = config
    const command = `grep -P '${regexp.source}' ${tagsUri.fsPath} | head -n ${limit}`

    output.appendLine(`Searching for ${regexp} in ${tagsUri.fsPath}...`)
    return asyncRunProc(output, command, basedir, stdout => filterMap(stdout.split('\n'), tag => parseTag(output, tag)))
  }

  function parseTag(output: vscode.OutputChannel, line: string): Tag | undefined {
    output.appendLine(`Parsing tag line: ${line}`)
    const [symbol, file, rawLineNumber] = line.split('\t')
    let lineNumber = parseInt(rawLineNumber)
    if (!symbol || !file || !lineNumber) return undefined
    const tag = { symbol, file, lineNumber }
    output.appendLine(`Parsed tag: ${JSON.stringify(tag)}`)
    return tag
  }

  function asyncRunProc<T>(out: vscode.OutputChannel, cmd: string, dir: vscode.Uri, f: (stdout: string) => T): Promise<T> {
    const cwd = dir.fsPath
    return new Promise((resolve, reject) => {
      out.appendLine(`Running '${cmd}' in '${cwd}'...`)

      const proc = exec(cmd, { cwd }, (error, stdout, stderr) => {
        if (error) {
          out.appendLine(`Error running '${cmd}':\n\t${error}`)
          reject(error)
        }

        stderr && out.appendLine(`Logs running '${cmd}':\n\t${stderr}`)
        !stdout && out.appendLine(`No output running '${cmd}'.`)

        resolve(f(stdout))
      })

      proc.stdin?.end()
      out.appendLine(`Ran '${cmd}'.`)
    })
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
