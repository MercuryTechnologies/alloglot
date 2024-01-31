# Change Log

All notable changes to the "alloglot" extension will be documented in this file.
The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/).
This project adhere's to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [unreleased]

- Move to a new repository.

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
