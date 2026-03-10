import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import {
  CodizeApiError,
  CodizeClient,
  type SandboxExecuteResponse,
  type SandboxRuntime,
} from "@codize/sdk";
import type { Command } from "commander";
import { readConfig } from "../config.ts";
import { CliError } from "../error.ts";

const EXTENSION_TO_RUNTIME: Record<string, SandboxRuntime> = {
  ".ts": "node-typescript",
  ".js": "node",
  ".py": "python",
  ".rb": "ruby",
  ".go": "go",
  ".rs": "rust",
  ".sh": "bash",
};

const RUNTIME_TO_EXTENSION: Record<SandboxRuntime, string> = {
  "node-typescript": ".ts",
  node: ".js",
  python: ".py",
  ruby: ".rb",
  go: ".go",
  rust: ".rs",
  bash: ".sh",
};

function detectRuntime(filePath: string): SandboxRuntime | null {
  const ext = extname(filePath).toLowerCase();
  return EXTENSION_TO_RUNTIME[ext] ?? null;
}

function resolveRuntime(files: string[]): SandboxRuntime {
  const entrypoint = files[0];
  if (entrypoint == null) {
    throw new CliError("No files specified.");
  }
  const detected = detectRuntime(entrypoint);
  if (detected == null) {
    throw new CliError(
      `Cannot detect runtime for '${entrypoint}'. Use --runtime to specify.`,
    );
  }
  return detected;
}

function readFiles(files: string[]): { name: string; content: string }[] {
  return files.map((filePath) => {
    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new CliError(`Cannot read file '${filePath}': ${message}`);
    }
    return { name: basename(filePath), content };
  });
}

function decodeBase64(encoded: string): string {
  return Buffer.from(encoded, "base64").toString();
}

export function registerRunCommand(program: Command): void {
  program
    .command("run")
    .description("Execute source files in the Codize Sandbox")
    .argument("[files...]", "Source files to execute")
    .option(
      "-r, --runtime <runtime>",
      "Runtime override (auto-detected from extension by default)",
    )
    .option(
      "-k, --api-key <key>",
      "Codize API key (defaults to CODIZE_API_KEY env var)",
    )
    .option("--json", "Output result as JSON instead of plain text")
    .option(
      "-e, --eval <code>",
      "Inline code to execute (requires --runtime, can be specified multiple times)",
      (val: string, prev: string[]) => [...prev, val],
      [] as string[],
    )
    .action(
      async (
        files: string[],
        options: {
          runtime?: SandboxRuntime;
          apiKey?: string;
          json?: boolean;
          eval: string[];
        },
      ) => {
        if (options.eval.length > 0 && files.length > 0) {
          throw new CliError("Cannot use --eval together with file arguments.");
        }

        if (options.eval.length === 0 && files.length === 0) {
          throw new CliError(
            "No input provided. Specify source files or use --eval.",
          );
        }

        const config = readConfig();
        const apiKey =
          options.apiKey ?? process.env["CODIZE_API_KEY"] ?? config.apiKey;
        if (!apiKey) {
          throw new CliError(
            "API key is required. Use --api-key, set CODIZE_API_KEY, or run `codize config set api-key <key>`.",
          );
        }

        let runtime: SandboxRuntime;
        let filePayloads: { name: string; content: string }[];

        if (options.eval.length > 0) {
          if (!options.runtime) {
            throw new CliError(
              "Option --runtime is required when using --eval.",
            );
          }
          runtime = options.runtime;
          const ext = RUNTIME_TO_EXTENSION[runtime] ?? "";
          filePayloads = options.eval.map((code, i) => ({
            name: `file${i}${ext}`,
            content: code,
          }));
        } else {
          runtime = options.runtime ?? resolveRuntime(files);
          filePayloads = readFiles(files);
        }

        const client = new CodizeClient({ apiKey });
        let result: SandboxExecuteResponse;
        try {
          result = await client.sandbox.execute({
            runtime,
            files: filePayloads,
          });
        } catch (err) {
          if (err instanceof CodizeApiError) {
            let message = `API error [${err.code}] ${err.message} (HTTP ${err.status})`;
            if (err.errors != null && err.errors.length > 0) {
              const details = err.errors
                .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
                .join("\n");
              message += "\n" + details;
            }
            throw new CliError(message);
          }
          throw err;
        }

        if (options.json) {
          const indent = process.stdout.isTTY ? 2 : undefined;
          process.stdout.write(
            JSON.stringify(result.data, null, indent) + "\n",
          );
        } else {
          if (
            result.data.compile != null &&
            result.data.compile.output !== ""
          ) {
            process.stderr.write(decodeBase64(result.data.compile.output));
          }
          if (result.data.run != null) {
            process.stdout.write(decodeBase64(result.data.run.output));
          }
        }

        if (!options.json) {
          if (
            result.data.compile != null &&
            result.data.compile.exitCode !== 0
          ) {
            process.exitCode = result.data.compile.exitCode;
          } else if (result.data.run != null) {
            process.exitCode = result.data.run.exitCode;
          } else {
            process.exitCode = 1;
          }
        }
      },
    );
}
