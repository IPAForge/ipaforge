// Building blocks every message shares: the protocol version, ids and errors.
import { type ErrorCode, isErrorCode, type SerializedError } from "@loadstar/kernel";
import { z } from "zod";

/** Bumped on any incompatible change; both sides ship together, so a mismatch is a bug, never negotiated. */
export const PROTOCOL_VERSION = 1;

export const versionSchema = z.literal(PROTOCOL_VERSION);

/** A required, non-empty string. */
export const textSchema = z.string().min(1);

export const idSchema = textSchema.max(128);

const referenceSchema = z.object({ id: idSchema });

/** The id of a message that failed validation, when it has a usable one, so the failure can still be answered. */
export const referencedId = (message: unknown): string | undefined => referenceSchema.safeParse(message).data?.id;

export const recordSchema = z.record(z.string(), z.unknown());

const errorCodeSchema = z.custom<ErrorCode>(isErrorCode, "unknown error code");

/**
 * A LoadstarError as `toJSON()` writes it, cause chain included. Zod types optionals as `?: T | undefined`; a parsed
 * message never holds an explicit `undefined` there, so the exact type is safe.
 */
export const serializedErrorSchema: z.ZodType<SerializedError> = z.lazy(
  () =>
    z.object({
      name: z.string(),
      message: z.string(),
      code: errorCodeSchema.optional(),
      data: recordSchema.optional(),
      cause: serializedErrorSchema.optional(),
    }) as z.ZodType<SerializedError>,
);
