import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { CliError } from "./error.ts";

export interface Config {
  apiKey?: string;
}

/** Maps CLI key names (e.g. "api-key") to Config property names (e.g. "apiKey"). */
export const CONFIG_KEY_MAP: Record<string, keyof Config> = {
  "api-key": "apiKey",
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function getConfigFilePath(): string {
  const xdgConfigHome = process.env["XDG_CONFIG_HOME"];
  const base =
    xdgConfigHome != null && xdgConfigHome !== ""
      ? xdgConfigHome
      : join(homedir(), ".config");
  return join(base, "codize", "config.json");
}

export function readConfig(): Config {
  const filePath = getConfigFilePath();
  if (!existsSync(filePath)) {
    return {};
  }
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new CliError(
      `Cannot read config file '${filePath}': ${errorMessage(err)}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CliError(
      `Config file '${filePath}' contains invalid JSON. Fix or delete it to continue.`,
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new CliError(
      `Config file '${filePath}' must be a JSON object. Fix or delete it to continue.`,
    );
  }
  const obj = parsed as Record<string, unknown>;
  const config: Config = {};
  if ("apiKey" in obj && typeof obj["apiKey"] !== "string") {
    throw new CliError(
      `Config file '${filePath}': 'apiKey' must be a string, got ${typeof obj["apiKey"]}. Fix or delete it to continue.`,
    );
  }
  if (typeof obj["apiKey"] === "string") {
    config.apiKey = obj["apiKey"];
  }
  return config;
}

export function writeConfig(config: Config): void {
  const filePath = getConfigFilePath();
  const dir = dirname(filePath);
  try {
    mkdirSync(dir, { recursive: true });
  } catch (err) {
    throw new CliError(
      `Cannot create config directory '${dir}': ${errorMessage(err)}`,
    );
  }
  const json = JSON.stringify(config, null, 2) + "\n";
  try {
    writeFileSync(filePath, json, "utf-8");
  } catch (err) {
    throw new CliError(
      `Cannot write config file '${filePath}': ${errorMessage(err)}`,
    );
  }
}
