[← Device](device.md) · [Back to README](../README.md) · [Roadmap →](roadmap.md)

# Apple Account

`@loadstar/apple` signs in to an Apple ID the way Apple's own apps do, so Loadstar can get a free development certificate and provisioning profiles. Your password is only ever sent to Apple. It never leaves the computer in readable form: the sign-in uses SRP, so Apple receives a proof that you know the password, not the password itself.

## How sign-in works

1. **Machine identity (anisette).** Apple only accepts sign-ins from machines it recognises. A public anisette server helps this computer register once with Apple and then produces the one-time headers each request needs.
   - The server never sees your Apple ID or password.
   - Loadstar keeps one identity per server and reuses it. Apple distrusts a new machine on every attempt.
   - If a server is down, the next one is used automatically.
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
- Passwords are kept only if you choose, and only in the OS keychain.

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

## For contributors

```bash
pnpm --filter @loadstar/desktop apple-probe preflight   # Apple reachable, clock, anisette health
pnpm --filter @loadstar/desktop apple-probe anisette    # which server works (header names only)
LOG_LEVEL=debug pnpm --filter @loadstar/desktop apple-probe signin   # real account, interactive
```

- Everything Apple-facing is in `packages/apple/src/domain/config.ts` and can be overridden: endpoints, client identity, the URL-bag identity, the `cpd` header list, the Xcode version and the anisette server list. When Apple changes something, the fix is usually there.
- `LOG_LEVEL=debug` logs the shape of every GrandSlam request and the status Apple returns, never secrets.
- What changed and why is recorded in `docs/design/research.md` §7 and `docs/design/failure-catalogue.md`.

## See Also

- [Device](device.md): installing what gets signed
- [Code Signing](signing.md)
