import type { Slice } from "@signer/domain/macho/types.ts";

/** FairPlay-encrypted (App Store) slice: LC_ENCRYPTION_INFO(_64) with a non-zero `cryptid`. */
export const isEncryptedSlice = (slice: Slice): boolean => slice.cryptid !== 0;
