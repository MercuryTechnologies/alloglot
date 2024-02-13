import * as vscode from 'vscode'
import * as qfgets from 'qfgets'

import { ImportsProviderConfig, LanguageConfig, StringTransformation, TagsConfig } from './config'

export function makeTags(config: LanguageConfig): vscode.Disposable {
  const { languageId, tags } = config
  if (!languageId || !tags) return vscode.Disposable.from()

  const { completionsProvider, definitionsProvider, importsProvider } = tags

  const basedir: vscode.Uri | undefined = vscode.workspace.workspaceFolders?.[0].uri
  const tagsUri: vscode.Uri | undefined = basedir && vscode.Uri.joinPath(basedir, tags.file)

  if (!basedir || !tagsUri) return vscode.Disposable.from()

  const tagsSource = makeTagsSource(tagsUri)

  const disposables: Array<vscode.Disposable> = []

  if (completionsProvider) disposables.push(
    vscode.languages.registerCompletionItemProvider(
      languageId,
      {
        provideCompletionItems: (document, position) => {
          const wordRange = document.getWordRangeAtPosition(position)
          if (!wordRange) return Promise.resolve([])
          return tagsSource
            .findPrefix(document.getText(wordRange))
            .then(tags => tags.map(tag => new vscode.CompletionItem(tag.symbol)))
        }
      }
    )
  )

  if (definitionsProvider) disposables.push(
    vscode.languages.registerDefinitionProvider(
      languageId,
      {
        provideDefinition: (document, position) => {
          const wordRange = document.getWordRangeAtPosition(position)
          if (!wordRange) return Promise.resolve([])
          return tagsSource
            .findExact(document.getText(wordRange))
            .then(tags => tags.map(tag => new vscode.Location(vscode.Uri.joinPath(basedir, tag.file), new vscode.Position(tag.lineNumber, 0))))
        }
      }
    )
  )

  if (importsProvider) {
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

    function renderModuleName(tag: Tag): string | undefined {
      const fileMatcher = new RegExp(importsProvider!.matchFromFilepath)
      const match = tag.file.match(fileMatcher)
      if (!match || match.length === 0) return undefined
      const tform = importsProvider!.renderModuleName
        .map(op => (xs: Array<string>) => applyStringTransformation(op, xs))
        .reduce((f, g) => (xs: Array<string>) => f(g(xs)), x => x)
      return tform([match[0]]).join()
    }

    function renderImportLine(tag: Tag): string | undefined {
      const module = renderModuleName(tag)
      if (!module) return undefined
      const symbol = tag.symbol
      return importsProvider!.importLinePattern.replace('${module}', module).replace('${symbol}', symbol)
    }

    function findImportPosition(document: vscode.TextDocument): vscode.Position {
      const importMatcher = new RegExp(importsProvider!.importLinePattern.replace('${module}', '(.*)').replace('${symbol}', '(.*)'))
      const fullText = document.getText().split('\n')
      const firstImportLine = fullText.findIndex(line => line.match(importMatcher))
      if (firstImportLine >= 0) return new vscode.Position(firstImportLine, 0)
      const firstBlankLine = fullText.findIndex(line => line.match(/^\s*$/))
      if (firstBlankLine >= 0) return new vscode.Position(firstBlankLine, 0)
      return new vscode.Position(0, 0)
    }

    function makeCodeAction(document: vscode.TextDocument, tag: Tag): vscode.CodeAction | undefined {
      const renderedImport = renderImportLine(tag)
      if (!renderedImport) return undefined
      const renderedModuleName = renderModuleName(tag)
      if (!renderedModuleName) return undefined
      const position = findImportPosition(document)

      const action = new vscode.CodeAction(`Add import: ${renderedModuleName}`, vscode.CodeActionKind.QuickFix)
      action.edit = new vscode.WorkspaceEdit()
      action.edit.insert(document.uri, position, renderedImport)
      return action
    }

    disposables.push(
      vscode.languages.registerCodeActionsProvider(languageId, {
        provideCodeActions: (document, range) => {
          return tagsSource.findExact(document.getText(range))
            .then(tags => tags.map(tag => makeCodeAction(document, tag)).filter(x => x) as Array<vscode.CodeAction>)
        }
      })
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
