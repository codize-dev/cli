import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { CodizeApiError, CodizeClient } from "@codize/sdk";
import type { Command } from "commander";
import { CliError } from "../error.ts";

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ".ts": "typescript",
  ".js": "javascript",
  ".py": "python",
  ".rb": "ruby",
  ".go": "go",
  ".rs": "rust",
};

function detectLanguage(filePath: string): string | null {
  const ext = extname(filePath).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] ?? null;
}

function resolveLanguage(files: string[]): string {
  const entrypoint = files[0];
  if (entrypoint == null) {
    throw new CliError("No files specified.");
  }
  const detected = detectLanguage(entrypoint);
  if (detected == null) {
    throw new CliError(
      `Cannot detect language for '${entrypoint}'. Use --language to specify.`,
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

export function registerRunCommand(program: Command): void {
  program
    .command("run")
    .description("Execute source files in the Codize Sandbox")
    .argument("<files...>", "Source files to execute")
    .option(
      "-l, --language <language>",
      "Language override (auto-detected from extension by default)",
    )
    .option(
      "-k, --api-key <key>",
      "Codize API key (defaults to CODIZE_API_KEY env var)",
    )
    .action(
      async (
        files: string[],
        options: { language?: string; apiKey?: string },
      ) => {
        const apiKey = options.apiKey ?? process.env["CODIZE_API_KEY"];
        if (!apiKey) {
          throw new CliError(
            "API key is required. Set CODIZE_API_KEY or use --api-key.",
          );
        }

        const language = options.language ?? resolveLanguage(files);
        const filePayloads = readFiles(files);

        const client = new CodizeClient({ apiKey });
        let result: Awaited<ReturnType<typeof client.sandbox.execute>>;
        try {
          result = await client.sandbox.execute({
            language,
            files: filePayloads,
          });
        } catch (err) {
          if (err instanceof CodizeApiError) {
            throw new CliError(
              `API error [${err.code}] ${err.message} (HTTP ${err.status})`,
            );
          }
          throw err;
        }

        if (result.data.compile != null && result.data.compile.output !== "") {
          process.stderr.write(result.data.compile.output);
        }

        process.stdout.write(result.data.run.output);
        if (result.data.compile != null && result.data.compile.exitCode !== 0) {
          process.exitCode = result.data.compile.exitCode ?? 1;
        } else {
          process.exitCode = result.data.run.exitCode ?? 1;
        }
      },
    );
}
