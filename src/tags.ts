import * as vscode from 'vscode'
import * as qfgets from 'qfgets'

import { LanguageConfig, StringTransformation, alloglot } from './config'

export function makeTags(config: LanguageConfig): vscode.Disposable {
  const { languageId, tags } = config
  if (!languageId || !tags) return vscode.Disposable.from()

  const { completionsProvider, definitionsProvider, importsProvider } = tags

  const basedir: vscode.Uri | undefined = vscode.workspace.workspaceFolders?.[0].uri
  const tagsUri: vscode.Uri | undefined = basedir && vscode.Uri.joinPath(basedir, tags.file)

  if (!basedir || !tagsUri) return vscode.Disposable.from()

  const tagsSource = makeTagsSource(tagsUri)

  const disposables: Array<vscode.Disposable> = []

  if (completionsProvider) {
    function getCompletions(document: vscode.TextDocument, position: vscode.Position): Promise<Array<[vscode.CompletionItem, vscode.InlineCompletionItem]>> {
      const wordRange = document.getWordRangeAtPosition(position)
      if (!wordRange) return Promise.resolve([])
      return tagsSource
        .findPrefix(document.getText(wordRange))
        .then(tags => tags.map(tag => {
          const comp = new vscode.CompletionItem(tag.symbol)
          const inlComp = new vscode.InlineCompletionItem(tag.symbol, wordRange)
          return [comp, inlComp]
        }))
    }

    disposables.push(
      vscode.languages.registerCompletionItemProvider(languageId, {
        provideCompletionItems: (doc, pos) => getCompletions(doc, pos).then(xs => xs.map(([x, _]) => x))
      }),
      vscode.languages.registerInlineCompletionItemProvider(languageId, {
        provideInlineCompletionItems: (doc, pos) => getCompletions(doc, pos).then(xs => xs.map(([_, y]) => y))
      })
    )
  }

  if (definitionsProvider) disposables.push(
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

  if (importsProvider) {
    const { matchFromFilepath, importLinePattern, renderModuleName } = importsProvider
    function applyStringTransformation(cmd: StringTransformation, xs: Array<string>): Array<string> {
      switch (cmd.tag) {
        case "replace":
          return xs.map(x => x.replace(cmd.from, cmd.to))
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

    function renderImportLine(tag: Tag): { renderedImport?: string, renderedModuleName?: string } {
      const fileMatcher = new RegExp(matchFromFilepath)
      const match = tag.file.match(fileMatcher)
      const symbol = tag.symbol

      const tform = renderModuleName
        .map(op => (xs: Array<string>) => applyStringTransformation(op, xs))
        .reduce((f, g) => (xs: Array<string>) => f(g(xs)), x => x)

      const renderedModuleName = match && match.length > 0
        ? tform([match[0]]).join()
        : undefined

      const renderedImport = renderedModuleName
        ? importLinePattern.replace('${module}', renderedModuleName).replace('${symbol}', symbol)
        : undefined

      return { renderedImport, renderedModuleName }
    }

    function findImportPosition(document: vscode.TextDocument): vscode.Position {
      const importMatcher = new RegExp(importLinePattern.replace('${module}', '(.*)').replace('${symbol}', '(.*)'))
      const fullText = document.getText().split('\n')
      const firstImportLine = fullText.findIndex(line => line.match(importMatcher))
      if (firstImportLine >= 0) return new vscode.Position(firstImportLine, 0)
      const firstBlankLine = fullText.findIndex(line => line.match(/^\s*$/))
      if (firstBlankLine >= 0) return new vscode.Position(firstBlankLine, 0)
      return new vscode.Position(0, 0)
    }

    function makeCodeAction(document: vscode.TextDocument, tag: Tag): vscode.CodeAction | undefined {
      const { renderedImport, renderedModuleName } = renderImportLine(tag)
      if (!renderedImport || !renderedModuleName) return undefined
      const position = findImportPosition(document)

      const action = new vscode.CodeAction(`Add import: ${renderedModuleName}`, vscode.CodeActionKind.QuickFix)
      action.edit = new vscode.WorkspaceEdit()
      action.edit.insert(document.uri, position, renderedImport)
      return action
    }

    function provideCodeActions(document: vscode.TextDocument, range: vscode.Range): Promise<Array<vscode.CodeAction>> {
      return tagsSource.findExact(document.getText(range))
        .then(tags => tags.map(tag => makeCodeAction(document, tag)).filter(x => x) as Array<vscode.CodeAction>)
    }

    function runSuggestImports(editor: vscode.TextEditor): void {
      const { document, selection } = editor
      const wordRange = document.getWordRangeAtPosition(selection.start)
      if (!wordRange) return undefined
      const suggestions = provideCodeActions(document, wordRange)
      const options: vscode.QuickPickOptions = { title: 'Suggested Imports' }
      vscode.window.showQuickPick(suggestions.then(xs => xs.map(x => x.title)), { title: 'Suggested Imports' }).then(pick => {
        const action = pick && suggestions
          .then(xs => xs.find(x => x.title === pick))
          .then(x => x && x.edit)
          .then(edit => edit && vscode.workspace.applyEdit(edit))
      })
    }

    disposables.push(
      vscode.commands.registerTextEditorCommand(alloglot.commands.suggestImports, runSuggestImports),
      vscode.languages.registerCodeActionsProvider(languageId, { provideCodeActions })
    )
  }

  return vscode.Disposable.from(...disposables)
}

type Tag = {
  symbol: string
  file: string
  lineNumber: number
}

type TagsSource = {
  findPrefix(prefix: string): Promise<Array<Tag>>
  findExact(exact: string): Promise<Array<Tag>>
}

function makeTagsSource(tagsUri: vscode.Uri): TagsSource {

  function parseTag(line: string): Tag | undefined {
    const [symbol, file, rawLineNumber] = line.split('\t')
    let lineNumber = parseInt(rawLineNumber)
    if (!symbol || !file || !lineNumber) return undefined
    return { symbol, file, lineNumber }
  }

  function grep(regexp: RegExp, limit: number): Promise<Array<Tag>> {
    const results: Array<Tag> = []
    const fp = new qfgets.Fgets(tagsUri.fsPath)

    return new Promise((resolve, reject) => {
      try {
        while (!fp.feof() && results.length < limit) {
          const line = fp.fgets()
          if (line && line.match(regexp)) {
            const tag = parseTag(line)
            if (tag) results.push(tag)
          }
        }
        resolve(results)
      } catch (error) {
        reject(error)
      }
    })
  }

  return {
    findPrefix(prefix: string) {
      return grep(new RegExp(`^${prefix}`), 100)
    },
    findExact(exact: string) {
      return grep(new RegExp(`^${exact}\\b`), 100)
    }
  }
}
