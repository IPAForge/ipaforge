// Saved Apple IDs. Several can be kept and switched in one click — the documented fix when Apple blocks one ID's
// team for sideloading on a device. Metadata lives in a versioned index; sessions and (optionally) passwords are
// separate secret-store entries, so a missing entry is just "not saved".

import { type AccountIndex, readIndex, writeIndex } from "@apple/application/accounts/account-index.ts";
import { decodeSession, encodeSession } from "@apple/application/accounts/session-codec.ts";
import { type AppleSession, normalizeAppleId } from "@apple/domain/session.ts";
import { nonEmpty } from "@apple/domain/values.ts";
import { compact, ErrorCode, LoadstarError, type SecretStore, utf8Decode, utf8Encode } from "@loadstar/kernel";

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

const findAccount = (index: AccountIndex, id: string): SavedAccount => {
  const account = index.accounts.find((candidate) => candidate.id === id);
  if (!account) throw new LoadstarError(ErrorCode.AccountNotFound, { data: { id } });
  return account;
};

/** The account entry for a fresh sign-in, keeping what was already known about the account. */
const savedAccountFor = (session: AppleSession, existing: SavedAccount | undefined, now: Date): SavedAccount =>
  compact({
    id: normalizeAppleId(session.appleId),
    appleId: session.appleId,
    displayName: nonEmpty(displayNameOf(session) ?? existing?.displayName),
    teamId: nonEmpty(existing?.teamId),
    health: {
      ...(existing?.health ?? { bannedOnDevices: [] }),
      lastSuccessAt: now.toISOString(),
    },
  });

const byLastSuccess = (a: SavedAccount, b: SavedAccount): number =>
  (b.health.lastSuccessAt ?? "").localeCompare(a.health.lastSuccessAt ?? "");

export const createAccountStore = (secrets: SecretStore, clock: { now(): Date }): AccountStore => {
  const read = () => readIndex(secrets);
  const write = (index: AccountIndex) => writeIndex(secrets, index);

  const save: AccountStore["save"] = async (session, options = {}) => {
    const id = normalizeAppleId(session.appleId);
    const index = await read();
    const existing = index.accounts.find((account) => account.id === id);
    const account = savedAccountFor(session, existing, clock.now());
    await secrets.set(sessionKey(id), encodeSession(session));
    if (options.rememberPassword !== undefined)
      await secrets.set(passwordKey(id), utf8Encode(options.rememberPassword));
    await write({
      version: 1,
      active: id,
      accounts: [...index.accounts.filter((candidate) => candidate.id !== id), account],
    });
    return account;
  };

  const remove: AccountStore["remove"] = async (id) => {
    const index = await read();
    await secrets.delete(sessionKey(id));
    await secrets.delete(passwordKey(id));
    const stillActive = index.active !== id ? nonEmpty(index.active) : undefined;
    await write(
      compact({
        version: 1 as const,
        accounts: index.accounts.filter((account) => account.id !== id),
        active: stillActive,
      }),
    );
  };

  const update: AccountStore["update"] = async (id, patch) => {
    const index = await read();
    const current = findAccount(index, id);
    const banned = patch.health?.bannedOnDevices ?? current.health.bannedOnDevices;
    const updated: SavedAccount = {
      ...current,
      ...compact({ teamId: nonEmpty(patch.teamId) }),
      health: { ...current.health, ...patch.health, bannedOnDevices: [...new Set(banned)] },
    };
    await write({ ...index, accounts: index.accounts.map((account) => (account.id === id ? updated : account)) });
    return updated;
  };

  return {
    list: async () => (await read()).accounts,
    active: async () => {
      const index = await read();
      return index.accounts.find((account) => account.id === index.active);
    },
    save,
    switchTo: async (id) => {
      const index = await read();
      const account = findAccount(index, id);
      await write({ ...index, active: id });
      return account;
    },
    remove,
    session: async (id) => {
      const raw = await secrets.get(sessionKey(id));
      return raw ? decodeSession(raw) : undefined;
    },
    password: async (id) => {
      const raw = await secrets.get(passwordKey(id));
      return raw ? utf8Decode(raw) : undefined;
    },
    update,
    usableOn: async (udid) =>
      (await read()).accounts.filter((account) => !account.health.bannedOnDevices.includes(udid)).sort(byLastSuccess),
  };
};
