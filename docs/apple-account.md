[← Device](device.md) · [Back to README](../README.md) · [Install Flows →](install-flows.md)

# Apple Account

`@loadstar/apple` signs in to an Apple ID the way Apple's own apps do, so Loadstar can get a free development certificate and provisioning profiles. Your password is only ever sent to Apple. It never leaves the computer in readable form: the sign-in uses SRP, so Apple receives a proof that you know the password, not the password itself.

## How sign-in works

1. **Machine identity (anisette).** Apple only accepts sign-ins from machines it recognises. A public anisette server helps this computer register once with Apple and then produces the one-time headers each request needs.
   - The server never sees your Apple ID or password.
   - Loadstar keeps one identity per server and reuses it. Apple distrusts a new machine on every attempt.
   - If a server is down, the next one is used automatically.
   - The servers are a custom one (if set), the built-in ones, then the community list (`servers.sidestore.io/servers.json`, HTTPS servers only). The list is fetched when anisette is first needed and again once it is an hour old (on the next request, never polled); after a failed fetch it is tried again a minute later. The last list fetched is kept in the secret store, so an offline start or a failed fetch still uses it (`anisetteServerListMaxAgeMs`, `anisetteServerListRetryMs` in the config).
2. **Password check (SRP).** Apple checks a proof of your password and returns encrypted session data.
3. **Second factor.** If your account has trusted devices, Apple shows a code on them, and you type it into Loadstar.
4. **Developer token.** Loadstar requests the token Xcode uses for developer services. It is valid for about a year.

Apple adds steps from time to time. Loadstar handles the ones known today:
- an anisette **resync** request (`hsc 434`);
- **"code already sent"** (`hsc 409`);
- session data without a plist wrapper.

## Two-factor authentication

| Your account verifies with | Status |
|---|---|
| A code on a trusted iPhone, iPad or Mac | Works |
| SMS only | **Refused by Apple** (HTTP 403) for third-party clients since October 2026 (`apple.sms_unavailable`). Sign the Apple ID in on any Apple device once, so it can use device codes, or use another Apple ID. |
| Security keys only | Not supported (`apple.two_factor_unsupported`) |
| No 2FA | Works |

## Saved accounts

Several Apple IDs can be saved and switched with one click. This is also the fix when Apple blocks one ID's team for sideloading on a device (`device.profile_banned`): Loadstar marks that account and suggests another.
- Sessions are reused while Apple accepts them.
- Passwords are kept unless you choose otherwise ("Save my password in the system keychain" when signing in, ticked by default; `signIn({ appleId, rememberPassword: true })`), and only in the encrypted secret store whose key the OS keychain protects. With a saved password, an expired session is renewed without asking.
- Requests made with a session (app tokens, developer services) ask the anisette server the session was created with first, since Apple ties the session to that machine identity.
- **Signing out** (`engine.signOut(accountId)`, from Manage → Accounts) forgets the Apple ID, its session and its saved password. Its signing certificates stay in the secret store, so signing in again reuses them instead of using up the team's certificate slots.

## Why an Apple ID needs signing in again

When a saved session is not accepted, the main process logs why at info level under `desktop.apple` (run with `LOG_LEVEL=debug` to see the debug lines too). No token, key or password is ever logged.

| Line | Meaning |
|---|---|
| `GSA complete status` with `ec`, `hsc`, `au` | How Apple finished the sign-in (`au` is a second-factor or `repair` step) |
| `app token request refused` with `gsaCode`, `hsc`, `anisetteServer`, `sessionAnisetteServer` | Apple refused the app token for the saved session; `hsc: 401` is reported as `apple.session_expired` |
| `app token request failed` with `code` | The app token request failed for another reason (network, anisette) |
| `developer services refused the app token` with `action`, `httpStatus: 401` | The token was issued but developer services refused it; reported as `apple.session_expired` |
| `developer request failed` with `action`, `resultCode` | Developer services answered with an error (`1100` is reported as `apple.session_expired`) |
| `no saved session` / `saved session not accepted` with `code`, `request`, `gsaCode`, `hsc` | What `resume` found |
| `signing in again with the saved password` / `no saved password; the password is needed` (debug) | What `resume` does next |

## Developer services

After sign-in, Loadstar uses the same developer API Xcode uses, through `apple.developer(session)`:

| Task | What Loadstar does |
|---|---|
| **Team** | Lists your teams, marked free or paid. Your choice is remembered per Apple ID. |
| **Device** | Registers your iPhone or iPad on the team if it isn't registered yet. |
| **Certificate** | Reuses the certificate Loadstar saved earlier while Apple still lists it, and creates one (RSA-2048) only when needed. At Apple's limit you get a picker that shows **which tool made each certificate** and when it expires. Revoking one stops every app signed with it, on every device. |
| **App IDs** | Free accounts get 10 every 7 days. Loadstar **budgets before creating anything**: it reuses existing App IDs, counts only new ones, and tells you when the next slot frees up. (LiveContainer + SideStore needs 5.) Names are cleaned to ASCII letters and digits. |
| **App groups, profiles** | Registers and assigns the app group, then downloads one profile per app and extension. |

`provisionApp` does all of this in one call and returns the profiles the signer needs.

## Errors you may see

| Code | Meaning | What to do |
|---|---|---|
| `apple.anisette_unavailable` | No anisette server answered | Check the connection; try again later, or set a custom server |
| `apple.client_rejected` (`-80045`, `-90010`) | Apple is rejecting this sign-in method right now | Update Loadstar; it usually needs a config update |
| `apple.invalid_credentials` (`-22406`, `-20970`) | Wrong Apple ID or password | Check them. Loadstar never retries a wrong password, so your account cannot be locked by repeated attempts |
| `apple.account_locked` | Apple locked the account | Unlock it at iforgot.apple.com |
| `apple.account_refused` (`-22411`, `-22421`) | Apple refused this account right now | Wait, sign in on an Apple device once, or use another Apple ID |
| `apple.two_factor_invalid_code` | Wrong verification code | Enter the code again |
| `apple.sms_unavailable` | Apple refused or could not send the SMS | Use a trusted device or another Apple ID |
| `apple.clock_skew` | The computer's clock is wrong | Turn on automatic date and time |
| `apple.rate_limited` / `apple.service_unavailable` | Apple is busy (429/503) | Loadstar retries automatically; try again later |
| `apple.not_eligible` (1102, HTTP 403) | This Apple ID cannot be used for development (age, region, terms) | Use another Apple ID |
| `apple.email_unverified` (2160) | The Apple ID's email is not verified | Verify it at account.apple.com |
| `apple.team_agreement` (4550) | The chosen team needs the latest agreement accepted | Pick your personal team, or accept it at developer.apple.com |
| `apple.certificate_limit` (7460) | Too many development certificates | Pick one to revoke in the list (it shows which tool made each) |
| `apple.certificate_not_revocable` (7252, 7475) | That certificate cannot be revoked here | Leave it; it does not count for Loadstar |
| `apple.app_id_quota` | Not enough free App IDs this week | Wait for the date shown, or remove optional extensions |
| `apple.app_id_unavailable` (9401) | Another team owns this bundle ID | Change the bundle ID |
| `apple.invalid_app_id_name` (35) | Apple rejected the App ID name | Loadstar normalises names; report it if you see this |

## For contributors

```bash
pnpm --filter @loadstar/desktop apple-probe preflight   # Apple reachable, clock, anisette health
pnpm --filter @loadstar/desktop apple-probe anisette    # which server works (header names only)
pnpm --filter @loadstar/desktop apple-probe signin      # sign in (2FA); the session is saved (macOS Keychain)
pnpm --filter @loadstar/desktop apple-probe developer   # READ-ONLY: teams, devices, certificates, App IDs + quota
pnpm --filter @loadstar/desktop apple-probe accounts    # check saved sessions
pnpm --filter @loadstar/desktop apple-probe forget      # delete saved accounts
```

- Everything Apple-facing is in `packages/apple/src/domain/config.ts` and can be overridden: endpoints, client identity, the URL-bag identity, the `cpd` header list, the Xcode version and the anisette server list. When Apple changes something, the fix is usually there.
- `LOG_LEVEL=debug` logs the shape of every GrandSlam request and the status Apple returns, never secrets.
- What Apple requires today, and what changed and why, is recorded in `docs/design/failure-catalogue.md`.

## See Also

- [Install Flows](install-flows.md): how sign-in, team, certificate and App IDs are used to install
- [Device](device.md): installing what gets signed
- [Code Signing](signing.md)
