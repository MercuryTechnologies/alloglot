# Alloglot

Language agnostic IDE for VS Code.

## Features

- Full-feature generic LSP client.
- Allows user to specify files to poll for diagnostics information.
  - Supports arbitrary JSON formats via user-specified mapping.
  - Mapping is configurable for each file independently.
- Allows the user to configure a custom command as their code formatter.
- Allows the user to configure a custom URL for documentation/API search.
- Single extension supports arbitrarily-many language configurations.

## Configuration

A workspace-level configuration would look something like this.

```json
{
  "alloglot.languages": [
    {
      "languageId": "haskell",
      "serverCommand": "static-ls",
      "formatCommand": "fourmolu --mode stdout --stdin-input-file ${file}",
      "apiSearchUrl": "https://hoogle.haskell.org/?hoogle=${query}",
      "annotations": [
        {
          "file": "ghcid.out",
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
   * `${file}` will be interpolated with the path to the file.
   */
  formatCommand?: string

  /**
   * URL to documentation/API search.
   * `${query}` will be interpolated with the symbol under cursor.
   */
  apiSearchUrl?: string

  /**
   * A list of files to watch for compiler-generated JSON output.
   */
  annotations?: Array<AnnotationsConfig>
}

/**
 * A file to watch for compiler-generated JSON output, and instructions on how to marshal the JSON objects.
 */
export type AnnotationsConfig = {
  /**
   * The path to the file to watch.
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
