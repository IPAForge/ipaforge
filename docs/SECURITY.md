# Security Policy

Loadstar handles sensitive material: Apple ID credentials and sessions, development certificates and their private keys, provisioning profiles, and device pairing records (which grant access to an iPhone or iPad). Security reports are welcome and taken seriously.

## Reporting a vulnerability

**Do not open a public issue.** Report privately through GitHub:

1. Open the repository's **Security** tab.
2. Choose **Report a vulnerability** (GitHub private vulnerability reporting).
3. Describe the issue, how to reproduce it, and what an attacker could gain.

What to expect:
- **An acknowledgement within a few days.**
- **An assessment and a fix plan** as soon as the issue is confirmed.
- **Credit in the release notes and the advisory**, unless you prefer otherwise.
- **Please give us reasonable time to release a fix** before disclosing publicly.

## In scope

- Exposure of Apple ID passwords, session tokens, certificate private keys or `.p12` files.
  - This includes logs, crash reports and files on disk without the protection the docs describe.
- Pairing records or pairing files reaching apps or hosts the user did not choose.
- TLS or certificate-verification weaknesses: device TLS pinning, Apple endpoints, anisette servers, update channels.
- Code execution through crafted IPAs, plists, Mach-O files, ZIP archives or network responses.
- Supply-chain issues in the build or release pipeline.

## Out of scope

- Apple's own services and their policies (for example Apple refusing a sign-in method).
- Third-party anisette servers, except where Loadstar trusts them more than documented.
- Attacks that need full control of the user's computer or an unlocked, trusting device.

## Supported versions

Loadstar is pre-1.0. Fixes go into `main` and the next release; older pre-releases are not patched.
