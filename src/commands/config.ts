import type { Command } from "commander";
import type { Config } from "../config.ts";
import {
  CONFIG_KEY_MAP,
  getConfigFilePath,
  readConfig,
  writeConfig,
} from "../config.ts";
import { CliError } from "../error.ts";

function resolveConfigKey(key: string): keyof Config {
  const prop = CONFIG_KEY_MAP[key];
  if (prop == null) {
    throw new CliError(
      `Unknown config key '${key}'. Valid keys: ${Object.keys(CONFIG_KEY_MAP).join(", ")}.`,
    );
  }
  return prop;
}

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command("config")
    .description("Manage CLI configuration");

  configCmd
    .command("set <key> <value>")
    .description("Set a config value")
    .action((key: string, value: string) => {
      const prop = resolveConfigKey(key);
      const config = readConfig();
      config[prop] = value;
      writeConfig(config);
      process.stdout.write(`Set ${key}.\n`);
    });

  configCmd
    .command("get <key>")
    .description("Get a config value")
    .action((key: string) => {
      const prop = resolveConfigKey(key);
      const config = readConfig();
      const val = config[prop];
      if (val == null) {
        throw new CliError(`Config key '${key}' is not set.`);
      }
      process.stdout.write(`${val}\n`);
    });

  configCmd
    .command("list")
    .description("List all config values")
    .action(() => {
      const config = readConfig();
      for (const [cliKey, prop] of Object.entries(CONFIG_KEY_MAP)) {
        const val = config[prop];
        process.stdout.write(`${cliKey}=${val ?? "(not set)"}\n`);
      }
    });

  configCmd
    .command("path")
    .description("Show the config file path")
    .action(() => {
      process.stdout.write(`${getConfigFilePath()}\n`);
    });
}
