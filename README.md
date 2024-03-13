# Alloglot

Language agnostic IDE for VS Code.

## Features

- Supports zero-configuration for end users.
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
  "alloglot.activateCommand": "ghcid",
  "alloglot.deactivateCommand": "pgrep ghc | xargs kill",
  "alloglot.languages": [
    {
      "languageId": "cabal",
      "formatCommand": "cabal-fmt --stdout",
      "apiSearchUrl": "https://hackage.haskell.org/packages/search?terms=${query}"
    },
    {
      "languageId": "haskell",
      "serverCommand": "static-ls",
      "formatCommand": "fourmolu --mode stdout --stdin-input-file ${file}",
      "apiSearchUrl": "https://hoogle.haskell.org/?hoogle=${query}",
      "tags": [
        {
          "file": ".tags",
          "initTagsCommand": "ghc-tags -c",
          "refreshTagsCommand": "ghc-tags -c",
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
        {
          "file": "package-deps-index.tsv",
          "completionsProvider": true,
          "importsProvider": {
            "importLinePattern": "import ${module}",
            "matchFromFilepath": "(.*)",
            "renderModuleName": [
              {
                "tag": "replace",
                "from": "(Data\\.ByteString.*)",
                "to": "$1 qualified as BS"
              },
              {
                "tag": "replace",
                "from": "(Data\\.Text.*)",
                "to": "$1 qualified as T"
              },
              {
                "tag": "replace",
                "from": "(Data\\.ByteString.*Lazy.*) qualified as BS",
                "to": "$1 qualified as BSL"
              },
              {
                "tag": "replace",
                "from": "(Data\\.Text.*Lazy.*) qualified as T",
                "to": "$1 qualified as TL"
              },
              {
                "tag": "replace",
                "from": "(Data\\.Map.*)",
                "to": "$1 qualified as M"
              },
              {
                "tag": "replace",
                "from": "(Data\\.Set.*)",
                "to": "$1 qualified as S"
              },
              {
                "tag": "replace",
                "from": "(Data\\.Vector.*)",
                "to": "$1 qualified as V"
              }
            ]
          }
        }
      ],
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

### Zero-conf

Alloglot supports "zero-configuration" in the following sense.
If there is no user-level or workspace-level configuration present,
Alloglot will read configuration from a file `.vscode/alloglot.json` if one exists.
The format for this file is to drop the `alloglot.`-prefix on top-level keys,
but otherwise is the same.
This file can be checked into a project's git repository without causing issue,
since it is ignored if a user has user-level or workspace-level configuration.
An experienced contributor can create a `.vscode/alloglot.json` file and check it into the repository.
This can greatly reduce the effort new contributors expend to onboard to a project,
especially for large projects that use multiple programming languages, bespoke tooling, or complex build processes.

### Schema

The configuration schema is defined by the following typescript.
Configuration is highly flexible, with most fields being optional.
This allows use of the features you want without unwanted features getting in your way.

```typescript
/**
 * Extension configuration.
 */
export type TConfig = {
  /**
   * A shell command to run on activation.
   * The command will run asynchronously.
   * It will be killed (if it's still running) on deactivation.
   */
  activateCommand?: string

  /**
   * A shell command to run on deactivation.
   */
  deactivateCommand?: string

  /**
   * An array of per-language configurations.
   */
  languages?: Array<LanguageConfig>

  /**
   * If `true`, Alloglot will log more output.
   */
  verboseOutput?: boolean

  /**
   * If `true`, Alloglot will merge `.vscode/alloglot.json` into its config.
   */
  mergeConfigs?: boolean

  /**
   * Path to GNU Grep. Parsing tags files depends on GNU Grep. (BSD Grep is not supported.)
   */
  grepPath?: string
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
   * A list of tags files to use to find definitions, suggest completions, or suggest imports.
   */
  tags?: Array<TagsConfig>

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
```
