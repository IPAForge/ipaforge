import type { Logger } from "@loadstar/kernel";
export * from "@loadstar/signer";
export const load = () => import("@loadstar/kernel");
export type { Logger };
