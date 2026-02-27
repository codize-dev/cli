import { Command } from "commander";
import packageJson from "../package.json" with { type: "json" };
import { CliError } from "./error.ts";
import { registerRunCommand } from "./commands/run.ts";

const program = new Command();

program
  .name("codize")
  .description("A CLI tool for executing source files in the Codize Sandbox.")
  .version(packageJson.version);

registerRunCommand(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  const message =
    err instanceof CliError
      ? err.message
      : `Unexpected error: ${err instanceof Error ? err.message : String(err)}`;
  process.stderr.write(`error: ${message}\n`);
  process.exit(err instanceof CliError ? err.exitCode : 1);
});
