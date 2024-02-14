# Alloglot

Language agnostic IDE for VS Code.

## Features

- Full-feature generic LSP client.
- Allows the user to specify files to poll for diagnostics information.
  - Supports arbitrary JSON formats via user-specified mapping.
  - Mapping is configurable for each file independently.
- Allows the user to utilize a tags file to provide completions, definitions, and import suggestions.
- Allows the user to configure a custom command as their code formatter.
- Allows the user to configure a custom URL for documentation/API search.
- Single extension supports arbitrarily-many language configurations.

## Configuration

A workspace-level full configuration (in this example, for Haskell) would look something like this.
Most of the properties are optional, so you can make use of only the features that you want.

```json
{
  "alloglot.languages": [
    {
      "languageId": "haskell",
      "serverCommand": "static-ls",
      "formatCommand": "fourmolu --mode stdout --stdin-input-file ${file}",
      "apiSearchUrl": "https://hoogle.haskell.org/?hoogle=${query}",
      "tags": {
        "file": ".tags",
        "completionsProvider": true,
        "definitionsProvider": true,
        "importsProvider": {
          "importLinePattern": "import ${module} (${symbol})",
          "matchFromFilepath": "([A-Z][A-Za-z0-9_']*)(\\/([A-Z][A-Za-z0-9_']*))*\\.hs",
          "renderModuleName": [
            {
              "tag": "replace",
              "from": "\\.hs",
              "to": ""
            },
            {
              "tag": "replace",
              "from": "\\/",
              "to": "."
            }
          ]
        }
      },
      "annotations": [
        {
          "file": "ghc-out.json",
          "format": "jsonl",
          "mapping": {
            "file": ["span", "file"],
            "startLine": ["span", "startLine"],
            "startColumn": ["span", "startCol"],
            "endLine": ["span", "endLine"],
            "endColumn": ["span", "endCol"],
            "message": ["doc"],
            "severity": ["messageClass"]
          }
        },
        {
          "file": "hlint-out.json",
          "format": "json",
          "mapping": {
            "file": ["file"],
            "startLine": ["startLine"],
            "startColumn": ["startColumn"],
            "endLine": ["endLine"],
            "endColumn": ["endColumn"],
            "message": ["hint"],
            "severity": ["severity"],
            "replacements": ["to"]
          }
        }
      ]
    }
  ]
}
```

The configuration schema is defined by the following typescript.
Configuration is highly flexible, with most fields being optional.
This allows use of the features you want without unwanted features getting in your way.

```typescript
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
   * A list of files to watch for compiler-generated JSON output.
   */
  annotations?: Array<AnnotationsConfig>

  /**
   * A list of files containing identifier tags for this languages.
   */
  tags?: Array<TagsConfig>
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
   * (Remember to double-escape backslashes in JSON strings.)
   */
  matchFromFilepath: string

  /**
   * A list of transformations to apply to the matched module name.
   */
  renderModuleName: Array<StringTransformation>
}

export type StringTransformation
  = {"command": "replace", "args": [string, string]}
  | {"command": "split", "args": [string]}
  | {"command": "join", "args": [string]}
  | {"command": "toUpper"}
  | {"command": "toLower"}
  | {"command": "capitalize"}

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
```
