// import { readFileSync } from "node:fs";  <- commented out, must be ignored
/* import "electron"; */
import { sha256 } from "@noble/hashes/sha256";
import { kernel } from "@loadstar/kernel";
import { local } from "@signer/local.ts";
export const url = "https://example.com/import 'node:fs'";
export const template = `import x from "electron"`;
export const all = [sha256, kernel, local];
