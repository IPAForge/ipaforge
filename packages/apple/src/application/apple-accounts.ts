// The public facade of @loadstar/apple: anisette, sign-in with 2FA, app tokens, saved accounts and preflight.

import { type AccountStore, createAccountStore } from "@apple/application/accounts.ts";
import { type AnisetteService, createAnisetteService } from "@apple/application/anisette.ts";
import { type AppTokenService, createAppTokenService, XCODE_APP } from "@apple/application/app-token.ts";
import { type PreflightReport, runPreflight } from "@apple/application/preflight.ts";
import { createSignInService, type SignInInput, type SignInResult } from "@apple/application/sign-in.ts";
import { type AppleDepsInput, resolveAppleDeps } from "@apple/deps.ts";
import type { AnisetteServer } from "@apple/domain/config.ts";
import type { AppleSession, AppToken } from "@apple/domain/session.ts";
import { ErrorCode, LoadstarError } from "@loadstar/kernel";

export type ResumeResult = SignInResult | { readonly kind: "needs_password"; readonly appleId: string };

export interface AppleAccounts {
  readonly anisette: AnisetteService;
  readonly accounts: AccountStore;
  preflight(): Promise<PreflightReport>;
  signIn(input: SignInInput): Promise<SignInResult>;
  appToken(session: AppleSession, app?: string): Promise<AppToken>;
  /**
   * Re-opens a saved account: reuses its session while Apple accepts it, otherwise signs in again with the
   * saved password (usually without 2FA, since this machine is already known), otherwise asks for the password.
   */
  resume(id: string): Promise<ResumeResult>;
  /** Records that Apple blocked this account's profiles on a device, so the UI can offer another account. */
  markBanned(id: string, udid: string): Promise<void>;
}

export interface AppleAccountsOptions {
  /** A user-configured anisette server, tried first. */
  readonly customAnisetteServer?: AnisetteServer;
}

export const createAppleAccounts = (input: AppleDepsInput, options: AppleAccountsOptions = {}): AppleAccounts => {
  const deps = resolveAppleDeps(input);
  const anisette = createAnisetteService(
    deps,
    options.customAnisetteServer ? { custom: options.customAnisetteServer } : {},
  );
  const signInService = createSignInService(deps, anisette);
  const tokens: AppTokenService = createAppTokenService(deps, anisette);
  const accounts = createAccountStore(deps.secrets, deps.clock);

  const resume = async (id: string): Promise<ResumeResult> => {
    const account = (await accounts.list()).find((candidate) => candidate.id === id);
    if (!account) throw new LoadstarError(ErrorCode.AccountNotFound, { data: { id } });
    const session = await accounts.session(id);
    if (session) {
      try {
        await tokens.appToken(session, XCODE_APP);
        await accounts.update(id, { health: { lastSuccessAt: deps.clock.now().toISOString() } });
        return { kind: "signed_in", session };
      } catch (error) {
        if (!(error instanceof LoadstarError) || error.code !== ErrorCode.SessionExpired) throw error;
        deps.logger.info("saved session expired", { account: id });
      }
    }
    const password = await accounts.password(id);
    if (!password) return { kind: "needs_password", appleId: account.appleId };
    const result = await signInService.signIn({ appleId: account.appleId, password });
    if (result.kind === "signed_in") await accounts.save(result.session);
    return result;
  };

  return {
    anisette,
    accounts,
    preflight: () => runPreflight(deps, anisette),
    signIn: (signInInput) => signInService.signIn(signInInput),
    appToken: (session, app) => tokens.appToken(session, app),
    resume,
    markBanned: async (id, udid) => {
      const account = (await accounts.list()).find((candidate) => candidate.id === id);
      await accounts.update(id, {
        health: {
          bannedOnDevices: [...(account?.health.bannedOnDevices ?? []), udid],
          lastError: ErrorCode.ProfileBanned,
        },
      });
    },
  };
};
