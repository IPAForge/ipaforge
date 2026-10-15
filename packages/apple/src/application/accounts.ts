// Saved Apple IDs. Several can be kept and switched in one click — the documented fix when Apple blocks one ID's
// team for sideloading on a device. Metadata lives in a versioned index; sessions and (optionally) passwords are
// separate secret-store entries, so a missing entry is just "not saved".

import { type AppleSession, normalizeAppleId } from "@apple/domain/session.ts";
import {
  ErrorCode,
  fromBase64,
  LoadstarError,
  type SecretStore,
  toBase64,
  utf8Decode,
  utf8Encode,
} from "@loadstar/kernel";
import { z } from "zod";

const INDEX_KEY = "apple/accounts";
const sessionKey = (id: string) => `apple/session/${id}`;
const passwordKey = (id: string) => `apple/password/${id}`;

export interface AccountHealth {
  readonly lastSuccessAt?: string | undefined;
  /** Device UDIDs where Apple rejected this ID's profiles (0xe8008024). */
  readonly bannedOnDevices: string[];
  /** Last catalogued error code, for the account switcher. */
  readonly lastError?: string | undefined;
}

export interface SavedAccount {
  readonly id: string;
  readonly appleId: string;
  readonly displayName?: string | undefined;
  /** The team chosen for this account (Phase 4 team picker). */
  readonly teamId?: string | undefined;
  readonly health: AccountHealth;
}

const accountSchema = z.object({
  id: z.string(),
  appleId: z.string(),
  displayName: z.string().optional(),
  teamId: z.string().optional(),
  health: z.object({
    lastSuccessAt: z.string().optional(),
    bannedOnDevices: z.array(z.string()),
    lastError: z.string().optional(),
  }),
});

const indexSchema = z.object({
  version: z.literal(1),
  active: z.string().optional(),
  accounts: z.array(accountSchema),
});

type Index = z.infer<typeof indexSchema>;

const sessionSchema = z.object({
  appleId: z.string(),
  adsid: z.string(),
  idmsToken: z.string(),
  sessionKey: z.string(),
  cookie: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  anisetteServer: z.string(),
});

const encodeSession = (session: AppleSession): Uint8Array =>
  utf8Encode(
    JSON.stringify({ ...session, sessionKey: toBase64(session.sessionKey), cookie: toBase64(session.cookie) }),
  );

const decodeSession = (bytes: Uint8Array): AppleSession | undefined => {
  const parsed = sessionSchema.safeParse(JSON.parse(utf8Decode(bytes)));
  if (!parsed.success) return undefined;
  const { sessionKey: sk, cookie, firstName, lastName, ...rest } = parsed.data;
  return {
    ...rest,
    sessionKey: fromBase64(sk),
    cookie: fromBase64(cookie),
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
  };
};

export interface SaveOptions {
  /** Keep the password (in the OS-backed secret store) so the session can be renewed without asking. */
  readonly rememberPassword?: string;
}

export interface AccountStore {
  list(): Promise<SavedAccount[]>;
  active(): Promise<SavedAccount | undefined>;
  save(session: AppleSession, options?: SaveOptions): Promise<SavedAccount>;
  switchTo(id: string): Promise<SavedAccount>;
  /** Forgets the account, its session and its password. Removing an unknown account is not an error. */
  remove(id: string): Promise<void>;
  session(id: string): Promise<AppleSession | undefined>;
  password(id: string): Promise<string | undefined>;
  update(id: string, patch: { teamId?: string; health?: Partial<AccountHealth> }): Promise<SavedAccount>;
  /** Accounts not banned on `udid`, most recently successful first (for one-click switching). */
  usableOn(udid: string): Promise<SavedAccount[]>;
}

const displayNameOf = (session: AppleSession): string | undefined =>
  [session.firstName, session.lastName].filter(Boolean).join(" ") || undefined;

export const createAccountStore = (secrets: SecretStore, clock: { now(): Date }): AccountStore => {
  const read = async (): Promise<Index> => {
    const raw = await secrets.get(INDEX_KEY);
    if (!raw) return { version: 1, accounts: [] };
    const parsed = indexSchema.safeParse(JSON.parse(utf8Decode(raw)));
    return parsed.success ? parsed.data : { version: 1, accounts: [] };
  };
  const write = (index: Index) => secrets.set(INDEX_KEY, utf8Encode(JSON.stringify(index)));
  const find = (index: Index, id: string) => {
    const account = index.accounts.find((candidate) => candidate.id === id);
    if (!account) throw new LoadstarError(ErrorCode.AccountNotFound, { data: { id } });
    return account;
  };

  const store: AccountStore = {
    list: async () => (await read()).accounts,
    active: async () => {
      const index = await read();
      return index.accounts.find((account) => account.id === index.active);
    },
    save: async (session, options = {}) => {
      const id = normalizeAppleId(session.appleId);
      const index = await read();
      const existing = index.accounts.find((account) => account.id === id);
      const displayName = displayNameOf(session) ?? existing?.displayName;
      const account: SavedAccount = {
        id,
        appleId: session.appleId,
        ...(displayName ? { displayName } : {}),
        ...(existing?.teamId ? { teamId: existing.teamId } : {}),
        health: {
          ...(existing?.health ?? { bannedOnDevices: [] }),
          lastSuccessAt: clock.now().toISOString(),
        },
      };
      await secrets.set(sessionKey(id), encodeSession(session));
      if (options.rememberPassword !== undefined)
        await secrets.set(passwordKey(id), utf8Encode(options.rememberPassword));
      await write({
        version: 1,
        active: id,
        accounts: [...index.accounts.filter((candidate) => candidate.id !== id), account],
      });
      return account;
    },
    switchTo: async (id) => {
      const index = await read();
      const account = find(index, id);
      await write({ ...index, active: id });
      return account;
    },
    remove: async (id) => {
      const index = await read();
      await secrets.delete(sessionKey(id));
      await secrets.delete(passwordKey(id));
      const accounts = index.accounts.filter((account) => account.id !== id);
      await write({
        version: 1,
        accounts,
        ...(index.active && index.active !== id ? { active: index.active } : {}),
      });
    },
    session: async (id) => {
      const raw = await secrets.get(sessionKey(id));
      return raw ? decodeSession(raw) : undefined;
    },
    password: async (id) => {
      const raw = await secrets.get(passwordKey(id));
      return raw ? utf8Decode(raw) : undefined;
    },
    update: async (id, patch) => {
      const index = await read();
      const current = find(index, id);
      const banned = patch.health?.bannedOnDevices ?? current.health.bannedOnDevices;
      const updated: SavedAccount = {
        ...current,
        ...(patch.teamId ? { teamId: patch.teamId } : {}),
        health: { ...current.health, ...patch.health, bannedOnDevices: [...new Set(banned)] },
      };
      await write({ ...index, accounts: index.accounts.map((account) => (account.id === id ? updated : account)) });
      return updated;
    },
    usableOn: async (udid) =>
      (await read()).accounts
        .filter((account) => !account.health.bannedOnDevices.includes(udid))
        .sort((a, b) => (b.health.lastSuccessAt ?? "").localeCompare(a.health.lastSuccessAt ?? "")),
  };
  return store;
};
