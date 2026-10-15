// ScratchStore on disk: signed IPAs wait here between signing and installing.
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Writable } from "node:stream";
import { nodeFileSource } from "@desktop/main/adapters/file-source.ts";
import type { ScratchStore } from "@loadstar/installer";

/** Keys become nested paths; anything outside a safe character set is replaced. */
const safePath = (key: string): string =>
  key
    .split("/")
    .map((part) => part.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "_"))
    .filter((part) => part.length > 0)
    .join("/");

export const createFileScratchStore = (root: string): ScratchStore => {
  const pathOf = (key: string) => join(root, safePath(key));
  return {
    put: async (key, stream) => {
      const path = pathOf(key);
      await mkdir(dirname(path), { recursive: true });
      try {
        await stream.pipeTo(Writable.toWeb(createWriteStream(path)) as WritableStream<Uint8Array>);
      } catch (error) {
        await rm(path, { force: true });
        throw error;
      }
      return nodeFileSource(path);
    },
    delete: async (key) => {
      await rm(pathOf(key), { force: true });
    },
  };
};
