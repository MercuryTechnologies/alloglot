# Change Log

All notable changes to the "alloglot" extension will be documented in this file.
The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/).
This project adhere's to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [unreleased]

## [3.1.0]

- Add `onSaveCommand` to `LanguageConfig`. Can now configure a command to run on saved files.
- Restarting Alloglot no longer disposes of its main output channel.

## [3.0.4]

- Fix crashing `Alloglot: Restart` command.

## [3.0.3]

- fix bug in config booleans.

## [3.0.2]

- Update README.md for version 3.
- Fix bug that prevented using fallback config.
- Add timestamps to output.

## [3.0.1]

- Fix bug in setting config `grepPath`.

## [3.0.0]

- Support configurable path to `grep`.
- Support multiple tags configs. `alloglot.tags` must now be an array of `TagsConfig`.
- Support merging workspace config with fallback config.
- Some error handling and reporting for configs.

## [2.6.0]

- Add `deactivateCommand` to `TConfig` to run on extension `deactivate()`
- Add `verboseOutput` to `TConfig`. Hide some existing output behind said config.
- Minor wording changes in some UI output messages.
- Minor bugfixes in async processes.

## [2.5.1]

- Stream activate command stdout to output channel.

## [2.5.0]

- Add activation command.
- Fix bug in config lookup logic.

## [2.4.0]

- Centralized output channel.
- Reload config and restart extension when config changes.
- Add `initTagsCommand` and `refreshTagsCommand` to `TagsConfig`.
- Add _Restart Alloglot_ command.

## [2.3.0] - 2024-02-14

- If there the user has no user-level or workspace-level alloglot settings, settings will be read from a file `.vscode/alloglot.json` if one exists.

## [2.2.0] - 2024-02-13

- Add tags-based "completions", "go to definitions", and "suggest imports" code action.

## [2.1.1] - 2024-02-07

- Fix bug in document formatter that prevented text edits if the formatter logs to stderr.
- Add output channel for formatter.

## [2.1.0] - 2024-02-01

- Fix bug in annotations file paths.
- Fix bug in annotations where diagnostics collection are not cleaned up correctly.
- Give each annotations file its own diagnostics collection.

## [2.0.3] - 2024-02-01

- Debug language server startup.
- Fix error in example configuration in README.md

## [2.0.1] - 2024-01-30

- Move to a new repository.
- use a different name for each language's diagnostics collection
- allow scalar `replacements` field

## [2.0.0] - 2024-01-25

- Added: marshal arbitrary JSON to Annotation via use-configurable paths
- Removed: "start", "stop", and "restart" commands (they were broken)
- Fixed: `makeClient` now cleans up its resources correctly
- Improved documentation

## [1.2.0] - 2024-01-23

- Implement LSP client

## [1.0.3] - 2024-01-21

- Fix changelog

## [1.0.2] - 2024-01-22

- Change license
- Improve documentation

## [1.0.1] - 2024-01-21

- Poll user-specified files for diagnostics
- API search via user-specified URL
- Formatting via user-specified command
- Manual start, stop, and restart
