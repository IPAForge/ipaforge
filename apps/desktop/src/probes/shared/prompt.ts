import { createInterface } from "node:readline/promises";

export interface Prompt {
  readonly ask: (question: string) => Promise<string>;
  /** Reads a line without echoing it. */
  readonly askHidden: (question: string) => Promise<string>;
  /** A yes/no question that defaults to no: true only for "y". */
  readonly confirm: (question: string) => Promise<boolean>;
  readonly close: () => void;
}

type MutableStdout = NodeJS.WriteStream & { _mute?: boolean };

export const createPrompt = (): Prompt => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (question: string) => rl.question(question);

  const askHidden = async (question: string): Promise<string> => {
    const output = process.stdout as MutableStdout;
    process.stdout.write(question);
    const original = output.write.bind(output);
    // Swallow the echoed characters; only the final newline gets through.
    output.write = ((chunk: string | Uint8Array, ...rest: unknown[]) =>
      typeof chunk === "string" && chunk.includes("\n")
        ? original("\n", ...(rest as []))
        : true) as typeof output.write;
    try {
      return await rl.question("");
    } finally {
      output.write = original;
    }
  };

  const confirm = async (question: string) => (await ask(question)).trim().toLowerCase() === "y";

  return { ask, askHidden, confirm, close: () => rl.close() };
};
