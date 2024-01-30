/*
Portions of this software are derived from [ghcid](https://github.com/ndmitchell/ghcid) and subject to the original authors licensing terms, reproduced below.

> Copyright Neil Mitchell 2014-2023.
> All rights reserved.
>
> Redistribution and use in source and binary forms, with or without
> modification, are permitted provided that the following conditions are
> met:
>
>     * Redistributions of source code must retain the above copyright
>       notice, this list of conditions and the following disclaimer.
>
>     * Redistributions in binary form must reproduce the above
>       copyright notice, this list of conditions and the following
>       disclaimer in the documentation and/or other materials provided
>       with the distribution.
>
>     * Neither the name of Neil Mitchell nor the names of other
>       contributors may be used to endorse or promote products derived
>       from this software without specific prior written permission.
>
> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
> "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
> LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
> A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
> OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
> SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
> LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
> DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
> THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
> (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
> OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

import * as vscode from 'vscode'

import { Annotation, AnnotationsConfig, LanguageConfig, alloglot } from "./config";

export function makeAnnotations(config: LanguageConfig): vscode.Disposable {
  const { languageId, annotations } = config
  if (!languageId || !annotations || annotations.length === 0) return vscode.Disposable.from()

  const diagnostics = vscode.languages.createDiagnosticCollection(`${alloglot.collections.annotations}-${languageId}`)
  const watchers: Array<vscode.Disposable> = annotations.map(file => watchAnnotationsFile(diagnostics, file))

  const quickFixes = vscode.languages.registerCodeActionsProvider(
    languageId,
    { provideCodeActions: (document, range, context) => context.diagnostics.map(utils.asQuickFixes).flat() },
    { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
  )

  return vscode.Disposable.from(
    quickFixes,
    ...watchers,
    diagnostics
  )
}

function watchAnnotationsFile(diagnostics: vscode.DiagnosticCollection, cfg: AnnotationsConfig): vscode.Disposable {
  const messagePath = utils.path<string>(cfg.mapping.message)
  const filePath = utils.path<string>(cfg.mapping.file)
  const startLinePath = utils.path<number>(cfg.mapping.startLine)
  const startColumnPath = utils.path<number>(cfg.mapping.startColumn)
  const endLinePath = utils.path<number>(cfg.mapping.endLine)
  const endColumnPath = utils.path<number>(cfg.mapping.endColumn)
  const sourcePath = utils.path<string>(cfg.mapping.source)
  const severityPath = utils.path<string>(cfg.mapping.severity)
  const replacementsPath = utils.path<string | Array<string>>(cfg.mapping.replacements)
  const referenceCodePath = utils.path<string | number>(cfg.mapping.referenceCode)

  function marshalAnnotation(json: any): Annotation | undefined {
    const message = messagePath(json)
    const file = filePath(json)
    if (!message || !file) return

    const startLine = startLinePath(json) || 0
    const startColumn = startColumnPath(json) || 0
    const endLine = endLinePath(json) || startLine
    const endColumn = endColumnPath(json) || startColumn

    const replacements: Array<string> =
      typeof replacementsPath(json) === 'string'
        ? [replacementsPath(json) as string]
        : replacementsPath(json) as Array<string>

    return {
      message, file, startLine, startColumn, endLine, endColumn, replacements,
      source: sourcePath(json) || `${cfg.file}`,
      severity: utils.parseSeverity(severityPath(json)),
      referenceCode: referenceCodePath(json)?.toString(),
    }
  }

  function readAnnotations(bytes: Uint8Array): Array<Annotation> {
    const contents = Buffer.from(bytes).toString('utf8')
    const jsons: Array<any> = cfg.format === 'jsonl'
      ? contents.split('\n').map(line => JSON.parse(line))
      : JSON.parse(contents)
    const annotations = jsons.map(marshalAnnotation).filter(x => x) as Array<Annotation>
    return annotations
  }

  function annotationsBySourceFile(annotations: Array<Annotation>): Map<string, Array<Annotation>> {
    const sorted = new Map<string, Array<Annotation>>()
    annotations.forEach(annotation => {
      const annotationsForFile = sorted.get(annotation.file)
      annotationsForFile
        ? annotationsForFile.push(annotation)
        : sorted.set(annotation.file, [annotation])
    })
    return sorted
  }

  function addAnnotations(uri: vscode.Uri): void {
    vscode.workspace.fs.readFile(uri).then(bytes => {
      annotationsBySourceFile(readAnnotations(bytes)).forEach((anns, path) => {
        diagnostics.set(vscode.Uri.file(path), anns.map(utils.annotationAsDiagnostic))
      })
    })
  }

  const watchers = vscode.workspace.workspaceFolders?.map(ws => {
    const pattern = new vscode.RelativePattern(ws, cfg.file)
    const watcher = vscode.workspace.createFileSystemWatcher(pattern, false, false, false)

    watcher.onDidChange(addAnnotations)
    watcher.onDidCreate(addAnnotations)
    watcher.onDidDelete(diagnostics.delete)

    return watcher
  }) || []

  return vscode.Disposable.from(...watchers)
}

namespace utils {
  export function annotationAsDiagnostic(ann: Annotation): vscode.Diagnostic {
    const range = new vscode.Range(
      new vscode.Position(ann.startLine - 1, ann.startColumn - 1),
      new vscode.Position(ann.endLine - 1, ann.endColumn - 1)
    )

    // we are abusing the relatedInformation field to store replacements
    // we look them up later when we need to create quick fixes
    const relatedInformation = ann.replacements.map(replacement => {
      const uri = vscode.Uri.file(ann.file)
      const location = new vscode.Location(uri, range)
      return new vscode.DiagnosticRelatedInformation(location, replacement)
    })

    // i wish they gave an all-args constructor
    const diagnostic = new vscode.Diagnostic(range, ann.message, asDiagnosticSeverity(ann.severity))
    diagnostic.source = ann.source
    diagnostic.relatedInformation = relatedInformation
    diagnostic.code = ann.referenceCode
    return diagnostic
  }

  function asDiagnosticSeverity(sev: Annotation['severity']): vscode.DiagnosticSeverity {
    switch (sev) {
      case 'error': return vscode.DiagnosticSeverity.Error
      case 'warning': return vscode.DiagnosticSeverity.Warning
      case 'info': return vscode.DiagnosticSeverity.Information
      case 'hint': return vscode.DiagnosticSeverity.Hint
    }
  }

  // this depends on the fact that we're abusing the `relatedInformation` field
  // see `annotationAsDiagnostic` above
  export function asQuickFixes(diag: vscode.Diagnostic): Array<vscode.CodeAction> {
    const actions = diag.relatedInformation?.map(info => {
      const action = new vscode.CodeAction(diag.message, vscode.CodeActionKind.QuickFix)
      action.diagnostics = [diag]
      action.edit = new vscode.WorkspaceEdit
      action.edit.replace(info.location.uri, info.location.range, info.message)
      return action
    })
    return actions || []
  }

  export function path<T>(keys: Array<string> | undefined): (json: any) => T | undefined {
    if (!keys) return () => undefined
    else return json => {
      const result = keys.reduce((acc, key) => acc?.[key], json)
      if (result) return result as T
      else return
    }
  }

  export function parseSeverity(raw: string | undefined): Annotation['severity'] {
    if (!raw) return 'error'
    const lower = raw.toLowerCase()
    if (lower.includes('error')) return 'error'
    if (lower.includes('warning')) return 'warning'
    if (lower.includes('info')) return 'info'
    if (lower.includes('hint')) return 'hint'
    return 'error'
  }
}
