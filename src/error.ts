export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}
