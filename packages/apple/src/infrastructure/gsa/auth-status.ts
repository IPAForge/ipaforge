// Apple's JSON 2FA endpoints: the account's 2FA state (`/auth`) and the `service_errors` they answer with.

import type { AuthStatus } from "@apple/domain/two-factor.ts";
import { compact, utf8Decode } from "@loadstar/kernel";
import { z } from "zod";

const authStatusSchema = z.looseObject({
  trustedPhoneNumbers: z
    .array(
      z.looseObject({
        id: z.union([z.number(), z.string()]).transform(Number),
        numberWithDialCode: z.string().optional(),
        obfuscatedNumber: z.string().optional(),
      }),
    )
    .optional(),
  trustedDevices: z.array(z.looseObject({ id: z.union([z.string(), z.number()]).transform(String) })).optional(),
  securityCode: z.looseObject({ length: z.number().int().positive() }).optional(),
  authType: z.string().optional(),
  keyNames: z.array(z.string()).optional(),
  fsaChallenge: z.unknown().optional(),
  noTrustedDevices: z.boolean().optional(),
});

const serviceErrorsSchema = z.looseObject({
  service_errors: z.array(z.looseObject({ code: z.union([z.string(), z.number()]).transform(Number) })).optional(),
});

/** `authType` of legacy two-step accounts. */
const LEGACY_AUTH_TYPE = "hsa";

export const parseAuthStatus = (body: Uint8Array): AuthStatus => {
  const status = authStatusSchema.parse(JSON.parse(utf8Decode(body)));
  const phones = (status.trustedPhoneNumbers ?? []).map((phone) => ({
    id: phone.id,
    number: phone.numberWithDialCode ?? phone.obfuscatedNumber ?? String(phone.id),
  }));
  return compact({
    legacy: status.authType === LEGACY_AUTH_TYPE,
    phones,
    codeLength: status.securityCode?.length,
    hasSecurityKeys: (status.keyNames?.length ?? 0) > 0 || status.fsaChallenge !== undefined,
  });
};

/** Apple's JSON error body → the first service error code, when present. */
export const serviceErrorCode = (body: Uint8Array): number | undefined => {
  try {
    return serviceErrorsSchema.parse(JSON.parse(utf8Decode(body))).service_errors?.[0]?.code;
  } catch {
    return undefined;
  }
};
