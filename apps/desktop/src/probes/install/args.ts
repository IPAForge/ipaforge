// install-probe's command line: `<command> [arguments…] [--option <value>…] [--flag…]`.

/** Options that take a value; everything else starting with `--` is a flag. */
const VALUE_OPTIONS: ReadonlySet<string> = new Set(["--udid", "--account", "--team", "--channel"]);

export interface InstallProbeArgs {
  /** The command; empty when none was given. */
  readonly command: string;
  /** Positional arguments after the command. */
  readonly rest: readonly string[];
  readonly flag: (name: string) => boolean;
  readonly option: (name: string) => string | undefined;
}

const isOptionValue = (args: readonly string[], index: number): boolean => VALUE_OPTIONS.has(args[index - 1] ?? "");

export const parseInstallProbeArgs = (args: readonly string[]): InstallProbeArgs => {
  const flag = (name: string): boolean => args.includes(`--${name}`);
  const option = (name: string): string | undefined => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const positional = args.filter((arg, index) => !arg.startsWith("--") && !isOptionValue(args, index));
  const [command = "", ...rest] = positional;
  return { command, rest, flag, option };
};
