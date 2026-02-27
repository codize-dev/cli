# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@codize/cli` — a Node.js CLI tool (`codize` binary) that executes source files in the Codize cloud sandbox. Built with Commander.js, bundled with Bun, published to npm.

## Development Commands

```bash
# Install runtime tools (bun 1.3.10, node 24.14.0)
mise install

# Install dependencies
bun install

# Build (produces dist/index.js with node shebang)
bun run build

# Type check (no test or lint scripts are configured)
npx tsc --noEmit
```

## Build System

- **Bun** is used as the package manager and bundler (via `Bun.build` in `scripts/build.ts`)
- TypeScript compiler is used for type checking only (`noEmit: true`); Bun handles compilation
- Build output: single `dist/index.js` file with `#!/usr/bin/env node` shebang, targeting Node.js with external packages
- `bunfig.toml` enforces exact version pinning (`exact = true`)

## Architecture

```
src/index.ts          — Entry point: sets up Commander program, registers commands, handles top-level errors
src/error.ts          — CliError class (extends Error with exitCode)
src/commands/run.ts   — `codize run` command: reads files, calls CodizeClient.sandbox.execute(), outputs results
scripts/build.ts      — Build script using Bun.build API
```

### Command Registration Pattern

Each command is defined in `src/commands/` and exports a `register*Command(program)` function that is called from `src/index.ts`. The `run` command is currently the only command.

### Error Handling

- `CliError` is used for expected CLI errors with specific exit codes
- `CodizeApiError` (from `@codize/sdk`) is caught and wrapped into `CliError` in command handlers
- The top-level catch in `src/index.ts` writes to stderr and exits with the appropriate code

### SDK Dependency

The CLI consumes `@codize/sdk` from npm. The SDK provides `CodizeClient` which calls the Codize API (`POST /api/v1/sandbox/execute`).

## Release Process

Conventional Commits on `main` trigger Release Please to create a release PR. Merging that PR runs `npm publish` (which invokes `prepublishOnly` → `bun run build`) via GitHub Actions.
