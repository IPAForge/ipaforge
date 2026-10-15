// device-probe's command line: `<command> [arguments…] [--udid <udid>] [--flag…]`.

export interface DeviceProbeArgs {
  /** The command, `list` when none is given. */
  readonly command: string;
  /** Positional arguments after the command. */
  readonly rest: readonly string[];
  readonly flag: (name: string) => boolean;
  /** The value following `--name`, if any. */
  readonly option: (name: string) => string | undefined;
}

export const parseDeviceProbeArgs = (args: readonly string[]): DeviceProbeArgs => {
  const flag = (name: string): boolean => args.includes(`--${name}`);
  const option = (name: string): string | undefined => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  // Flags are not positional, and neither is the value of --udid.
  const positional = args.filter((arg, i) => !arg.startsWith("--") && !args[i - 1]?.startsWith("--udid"));
  const [command = "list", ...rest] = positional;
  return { command, rest, flag, option };
};
