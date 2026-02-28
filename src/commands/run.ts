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

const LANGUAGE_TO_EXTENSION: Record<string, string> = {
  typescript: ".ts",
  javascript: ".js",
  python: ".py",
  ruby: ".rb",
  go: ".go",
  rust: ".rs",
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
    .argument("[files...]", "Source files to execute")
    .option(
      "-l, --language <language>",
      "Language override (auto-detected from extension by default)",
    )
    .option(
      "-k, --api-key <key>",
      "Codize API key (defaults to CODIZE_API_KEY env var)",
    )
    .option("--json", "Output result as JSON instead of plain text")
    .option(
      "-e, --eval <code>",
      "Inline code to execute (requires --language, can be specified multiple times)",
      (val: string, prev: string[]) => [...prev, val],
      [] as string[],
    )
    .action(
      async (
        files: string[],
        options: {
          language?: string;
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

        const apiKey = options.apiKey ?? process.env["CODIZE_API_KEY"];
        if (!apiKey) {
          throw new CliError(
            "API key is required. Set CODIZE_API_KEY or use --api-key.",
          );
        }

        let language: string;
        let filePayloads: { name: string; content: string }[];

        if (options.eval.length > 0) {
          if (!options.language) {
            throw new CliError(
              "Option --language is required when using --eval.",
            );
          }
          language = options.language;
          const ext = LANGUAGE_TO_EXTENSION[language] ?? "";
          filePayloads = options.eval.map((code, i) => ({
            name: `file${i}${ext}`,
            content: code,
          }));
        } else {
          language = options.language ?? resolveLanguage(files);
          filePayloads = readFiles(files);
        }

        const client = new CodizeClient({ apiKey });
        let result: Awaited<ReturnType<typeof client.sandbox.execute>>;
        try {
          result = await client.sandbox.execute({
            language,
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
            process.stderr.write(result.data.compile.output);
          }
          if (result.data.run != null) {
            process.stdout.write(result.data.run.output);
          }
        }

        if (!options.json) {
          if (
            result.data.compile != null &&
            result.data.compile.exitCode !== 0
          ) {
            process.exitCode = result.data.compile.exitCode ?? 1;
          } else if (result.data.run != null) {
            process.exitCode = result.data.run.exitCode ?? 1;
          } else {
            process.exitCode = 1;
          }
        }
      },
    );
}
