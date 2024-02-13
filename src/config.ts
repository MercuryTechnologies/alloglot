/**
 * Extension configuration.
 */
export type Config = {
  /**
   * An array of per-language configurations.
   */
  languages: Array<LanguageConfig>
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
   * `${file}` will be replaced with the path to the file.
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
   * Use the contents of this tags file to suggest completions.
   */
  completionsProvider?: boolean

  /**
   * Use the contents of this tags file to go to definitions.
   */
  definitionsProvider?: boolean

  /**
   * Use the contents of this tags file to suggest imports.
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
   * (We will use the entire _match,_ not any captures.)
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

export namespace alloglot {
  export const root = 'alloglot' as const

  export namespace collections {
    export const annotations = `${alloglot.root}.annotations` as const
  }

  export namespace commands {
    const root = `${alloglot.root}.command` as const
    export const apiSearch = `${root}.apisearch` as const
    export const suggestImports = `${root}.suggestimports` as const
  }

  export namespace config {
    export const languages = 'languages' as const
  }
}
