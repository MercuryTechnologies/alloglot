# Alloglot

Language agnostic IDE for VS Code.

## Features

- [x] Reads code diagnostics info by polling a list of user-supplied JSON files.
- [x] Allows the user to configure a custom command as their code formatter.
- [x] Allows the user to configure a custom URL for documentation/API search.
- [x] Per-language LSP client.
- ~~Run a user-configurable command on activation and manage the child-process. (TODO)~~ (redundant)
- ~~Code navigation via a small subset of LSP. (TODO)~~ (redundant)

## Configuration

Alloglot uses the following configuration schema.

```typescript
type Config = {
  /**
   * An array of language configurations.
   */
  languages: Array<{
    /**
     * The unique language ID.
     * You can usually find this in a language's syntax-highlighting extension.
     */
    languageId: string

    /**
     * A command to start the language server.
     */
    serverCommand: string

    /**
     * A formatter command.
     * Reads from STDIN and writes to STDOUT.
     * `${file}` will be interpolated with the path to the file.
     */
    formatCommand: string

    /**
     * URL to documentation/API search.
     * `${query}` will be interpolated with the symbol under cursor.
     */
    apiSearchUrl: string

    /**
     * JSON files that will be polled for diagnostics.
     * See README.md for the format.
     */
    annotationsFiles: Array<string>
  }>
}
```

An example configuration follows.

```json
{
  "alloglot.languages": [
    {
      "languageId": "haskell",
      "serverCommand": "static-ls",
      "formatCommand": "fourmolu --mode stdout --stdin-input-file ${file}",
      "apiSearchUrl": "https://hoogle.haskell.org/?hoogle=${query}",
      "annotationsFiles": "ghcid.txt"
    }
  ]
}
```

## Diagnostics JSON format

Alloglot provides diagnostics information by polling a user-configurable list of JSON files.
The intention is that you start a filewatcher that runs a compiler on file save in a terminal, with the compiler writing its output to a JSON file.
On creation or change of the JSON file, Alloglot will read the file and interface with VS Code's diagnostics API.
The diagnostics will remain until the JSON file is changed or deleted.
This allows arbitrary sources of diagnostics, even for languages that have no VS Code extension.

Alloglot expects the JSON file be a list of _annotations,_ objects adhering to the following format.

```typescript
type Annotation = {
  /**
   * Source of this annotation.
   * E.g. the name of the compiler or linter that created it.
   */
  source: string

  /**
   * The diagnostic-severity levels supported by VS Code.
   */
  severity: 'error' | 'warning' | 'info' | 'hint'

  /**
   * Path to the file to which this diagnostic applies, relative to project root.
   */
  file: string

  /**
   * Document span info.
   * Lines and columns should be indexed from 1
   */
  startLine: number

  /**
   * Document span info.
   * Lines and columns should be indexed from 1
   */
  startColumn: number

  /**
   * Document span info.
   * Lines and columns should be indexed from 1
   */
  endLine: number

  /**
   * Document span info.
   * Lines and columns should be indexed from 1
   */
  endColumn: number

  /**
   * The error/warning message text.
   */
  message: string

  /**
   * List of textual replacements, in any, for VS Code's _Quick Fix_ feature.
   */
  replacements: Array<string>

  /**
   * Reference code for the error/warning message.
   * E.g. `"ts(2552)"`.
   */
  referenceCode?: string
}
```

## ~~Future work~~

### ~~Code Navigation~~

~~We intend to implement a client for a subset of the LSP narrowly focused on code navigation.~~
~~We intend to support the following requests.~~

- ~~Goto Definition~~
- ~~Find References~~
- ~~Hover~~
- ~~Document Symbols~~
- ~~Completion Proposals~~
- ~~Completion Item Resolve Request~~

~~The intention is to make code navigation possible for languages that don't have a more-robust language server.~~
~~A simple language server supporting these requests could be implemented using SQLite or even Ctags, for example.~~
~~Such a language server can watch for file save events and re-index a file on save.~~
~~This workflow decouples the background task of generating code navigation information from the forground task of presenting the information in the text editor.~~

This was made redundant, since we added a full LSP client from a library.

### ~~Startup and shutdown commands~~

~~Commands to run on extention activation and extention deactivation.~~
~~The intent is that you launch a filewatcher that runs a compiler or linter on file change.~~
~~This compiler or linter should write its output to a JSON file in the format described in [Diagnostics](#diagnostics).~~
~~This workflow decouples the background task of generating code diagnostics information from the forground task of presenting the information in the text editor.~~

This is made redundant, since the LSP client takes care of that for us.
