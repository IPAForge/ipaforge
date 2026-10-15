import type { FileSource } from "@loadstar/kernel";
import type { ExternalIpa } from "@rpc/domain/protocol/inputs.ts";

/** Turns an IPA the UI named (a picked file or a URL) into a readable file on the Engine's side. */
export type ResolveIpa = (ipa: ExternalIpa, signal: AbortSignal) => Promise<FileSource>;
