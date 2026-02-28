# Codize CLI

[![NPM Version](https://img.shields.io/npm/v/@codize/cli)](https://www.npmjs.com/package/@codize/cli)
[![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/codize-dev/cli/release-please.yml)](https://github.com/codize-dev/cli/actions/workflows/release-please.yml)
[![GitHub License](https://img.shields.io/github/license/codize-dev/cli)](../LICENSE)

A CLI tool for executing source files in the [Codize](https://codize.dev) Sandbox.

## Installation

```bash
$ npm install -g @codize/cli

# without global installation
$ npx @codize/cli --help
```

## Usage

### Configuration

Generate your API key at [codize.dev/settings/api-keys](https://codize.dev/settings/api-keys), then configure it using one of the following methods (listed in priority order):

1. **CLI flag:** `--api-key`
2. **Environment variable:** `CODIZE_API_KEY`
3. **Config file:** `codize config set api-key <key>`

```bash
# Save API key to config file (recommended)
$ codize config set api-key cdz_YourApiKeyHere

# Or use an environment variable
$ export CODIZE_API_KEY="cdz_YourApiKeyHere"
```

The config file is stored at `$XDG_CONFIG_HOME/codize/config.json` (defaults to `~/.config/codize/config.json`).

### Running a File

```bash
$ codize run main.ts
```

You can pass multiple files:

```bash
$ codize run main.ts utils.ts
```

### JSON Output

Use `--json` to get structured output for programmatic use:

```bash
$ codize run main.ts --json
{
  "compile": {
    "stdout": "",
    "stderr": "",
    "output": "",
    "exitCode": 0
  },
  "run": {
    "stdout": "Hello\n",
    "stderr": "",
    "output": "Hello\n",
    "exitCode": 0
  }
}
```

## License

[MIT](../LICENSE)
