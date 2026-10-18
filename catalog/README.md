# Catalog

`sources.json` lists what IPAForge can install and where each release comes from. The app downloads this file from `main`, so a change merged here reaches every user **without an app release**. That's how IPAForge keeps working when a project moves or a repository disappears. A built-in copy (`packages/catalog/src/domain/default-manifest.ts`, which must stay identical; a test checks this) is used when the file cannot be fetched.

## Format

```jsonc
{
  "version": 1,
  "apps": [
    {
      "id": "sidestore",                       // lower-case, digits, dashes
      "name": "SideStore",
      "bundleId": "com.SideStore.SideStore",   // original bundle ID, before sideload renaming
      "kind": "sidestore",                     // "sidestore" | "livecontainer-sidestore" | "app"
      "minimumIos": "15.0",
      "channels": {
        "stable":  { "github": { "repo": "owner/name", "asset": "App.ipa" } },
        "nightly": { "github": { "repo": "owner/name", "tag": "nightly", "asset": "App.ipa" },
                     "mirrors": [{ "github": { "repo": "mirror-owner/name", "tag": "nightly", "asset": "App.ipa" } }] }
      },
      "compatibility": [{ "iosFrom": "26.4", "channel": "nightly", "note": "stable cannot refresh on 26.4+" }]
    }
  ]
}
```

- **Locations:**
  - `github` resolves through the GitHub API: the latest release, or `tag`, and the asset with exactly that name, or, with one `*` in it, the first asset that fits (`StikDebug-*.ipa` for releases whose file name carries the version). No regular expressions: the manifest is fetched over the network.
  - `{ "url": "https://…", "sha256": "…", "size": … }` is a direct HTTPS download.
- **Mirrors** are tried in order when the primary repository, release or asset is gone.
- **Checksums are mandatory (fail closed).**
  - Every download is verified against a SHA-256, either the one GitHub publishes for the release asset or a `sha256` in the manifest, which pins a specific file.
  - `url` entries must always include `sha256`.
  - A release without any known checksum is refused (`catalog.checksum_missing`), never installed unverified.
- **`compatibility`** picks the recommended channel per iOS range (first match wins).

## Changing it

Open a pull request that edits **both** `sources.json` and the built-in copy. CI validates the schema and checks that the two match. Check a change locally with:

```bash
pnpm --filter @ipaforge/desktop catalog-probe                      # resolve every app and channel
pnpm --filter @ipaforge/desktop catalog-probe download sidestore stable
```
