import { readFileSync } from 'fs'
import * as vscode from 'vscode'

/**
 * Extension configuration.
 */
export type Config = {
  /**
   * A shell command to run on activation.
   * The command will run asynchronously.
   * It will be killed (if it's still running) on deactivation.
   */
  activateCommand?: string

  /**
   * An array of per-language configurations.
   */
  languages?: Array<LanguageConfig>
}

/**
 * Configuration for an arbitrary language.
 */
export type LanguageConfig = {
  /**
   * The unique language ID.
   * You can usually find this in a language's syntax-highlighting extension.
   */
  languageId: string

  /**
   * A command to start the language server.
   */
  serverCommand?: string

  /**
   * A formatter command.
   * Reads from STDIN and writes to STDOUT.
   * `${file}` will be replaced with the relative path to the file.
   */
  formatCommand?: string

  /**
   * URL to documentation/API search.
   * `${query}` will be replaced with the symbol under cursor.
   */
  apiSearchUrl?: string

  /**
   * Configuration for using a tags file to suggest completions, definitions, or imports.
   */
  tags?: TagsConfig

  /**
   * A list of files to watch for compiler-generated JSON output.
   */
  annotations?: Array<AnnotationsConfig>
}

export type TagsConfig = {
  /**
   * The relative path to the tags file.
   */
  file: string

  /**
   * A command to generate the tags file.
   */
  initTagsCommand?: string

  /**
   * A command to refresh the tags file when a file is saved.
   * `${file}` will be replaced with the relative path to the file.
   */
  refreshTagsCommand?: string

  /**
   * Indicates that this tags file should be used to suggest completions.
   */
  completionsProvider?: boolean

  /**
   * Indicates that this tags file should be used to go to definitions.
   */
  definitionsProvider?: boolean

  /**
   * Indicates that this tags file should be used to suggest imports for symbols.
   */
  importsProvider?: ImportsProviderConfig
}

/**
 * Configuration to use a tags file to suggests imports.
 */
export type ImportsProviderConfig = {
  /**
   * Pattern to create an import line.
   * `${module}` will be replaced with the module to import.
   * `${symbol}` will be replaced with the symbol to expose.
   */
  importLinePattern: string,

  /**
   * Regex pattern matching the part of a file path needed to construct a module name.
   * (We will use the entire _match,_ not the captures.)
   * (Remember to double-escape backslashes in JSON strings.)
   */
  matchFromFilepath: string

  /**
   * A list of transformations to apply to the string matched by `matchFromFilepath`.
   */
  renderModuleName: Array<StringTransformation>
}

export type StringTransformation
  = { tag: "replace", from: string, to: string }
  | { tag: "split", on: string }
  | { tag: "join", with: string }
  | { tag: "toUpper" }
  | { tag: "toLower" }
  | { tag: "capitalize" }

/**
 * A file to watch for compiler-generated JSON output, and instructions on how to marshal the JSON objects.
 */
export type AnnotationsConfig = {
  /**
   * The relative path to the file to watch.
   */
  file: string

  /**
   * `json` for a top-level array of objects.
   * `jsonl` for a newline-separated stream of objects.
   */
  format: 'json' | 'jsonl'

  /**
   * Mapping between properties of the JSON objects and properties of `Annotation`.
   */
  mapping: AnnotationsMapping
}

/**
 * Intermediate representation of compiler-generated JSON output and VS Code diagnostics.
 */
export type Annotation = {
  source: string
  severity: 'error' | 'warning' | 'info' | 'hint'
  file: string
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
  message: string
  replacements: Array<string>
  referenceCode?: string
}

/**
 * Mapping between arbitrary JSON object and properties of `Annotation`.
 * Each property is an array of strings that will be used as a path into the JSON object.
 */
export type AnnotationsMapping = {
  message: Array<string>
  file?: Array<string>
  startLine?: Array<string>
  startColumn?: Array<string>
  endLine?: Array<string>
  endColumn?: Array<string>
  source?: Array<string>
  severity?: Array<string>
  replacements?: Array<string>
  referenceCode?: Array<string>
}

export namespace Config {
  export function make(output: vscode.OutputChannel): Config {
    const empty: Config = {}

    function readFallback(): Config | undefined {
      const workspaceFolders = vscode.workspace.workspaceFolders?.map(folder => folder.uri)
      try {
        if (workspaceFolders && workspaceFolders.length > 0) {
          const fullPath = vscode.Uri.joinPath(workspaceFolders[0], alloglot.config.fallbackPath)
          output.appendLine(`Reading fallback configuration from ${fullPath.path}`)
          return JSON.parse(readFileSync(fullPath.path, 'utf-8'))
        } else {
          output.appendLine('No workspace folders found. Cannot read fallback configuration.')
          return undefined
        }
      } catch (err) {
        output.appendLine(`Error reading fallback configuration: ${err}`)
        return undefined
      }
    }

    function readSettings(): Config | undefined {
      output.appendLine('Reading configuration from workspace settings')
      const workspaceSettings = vscode.workspace.getConfiguration(alloglot.config.root)
      const activateCommand = workspaceSettings.get<string>(alloglot.config.activateCommand)
      const languages = workspaceSettings.get<Array<LanguageConfig>>(alloglot.config.languages)
      const settingsExist = !!(activateCommand || languages)
      output.appendLine(`Configuration exists in settings: ${settingsExist}`)
      if (settingsExist) return { activateCommand, languages }
      return undefined
    }

    return sanitizeConfig(readSettings() || readFallback() || empty)
  }

  function sanitizeConfig(config: Config): Config {
    return {
      activateCommand: config.activateCommand?.trim(),
      languages: config.languages?.filter(lang => {
        // make sure no fields are whitespace-only
        // we mutate the original object because typescript doesn't have a `filterMap` function

        lang.languageId = lang.languageId.trim()
        lang.serverCommand = lang.serverCommand?.trim()
        lang.formatCommand = lang.formatCommand?.trim()
        lang.apiSearchUrl = lang.apiSearchUrl?.trim()

        lang.annotations = lang.annotations?.filter(ann => {
          ann.file = ann.file.trim()
          return ann.file
        })

        if (lang.tags) {
          lang.tags.file = lang.tags.file.trim()
          lang.tags.initTagsCommand = lang.tags.initTagsCommand?.trim()
          lang.tags.refreshTagsCommand = lang.tags.refreshTagsCommand?.trim()
          if (!lang.tags?.importsProvider?.importLinePattern.trim()) lang.tags.importsProvider = undefined
          if (!lang.tags?.importsProvider?.matchFromFilepath.trim()) lang.tags.importsProvider = undefined
          if (!lang.tags.file) lang.tags = undefined
        }

        return lang.languageId
      })
    }
  }
}

export namespace alloglot {
  export const root = 'alloglot' as const

  export namespace collections {
    export const annotations = `${root}.annotations` as const
  }

  export namespace components {
    export const apiSearch = 'apisearch' as const
    export const annotations = 'annotations' as const
    export const formatter = 'formatter' as const
    export const client = 'client' as const
    export const tags = 'tags' as const
  }

  export namespace commands {
    const root = `${alloglot.root}.command` as const
    export const restart = `${root}.restart` as const
    export const apiSearch = `${root}.apisearch` as const
    export const suggestImports = `${root}.suggestimports` as const
  }

  export namespace config {
    export const root = alloglot.root
    export const fallbackPath = `.vscode/${root}.json` as const
    export const languages = 'languages' as const
    export const activateCommand = 'activateCommand' as const
  }
}
