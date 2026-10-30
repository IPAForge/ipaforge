[← Install Flows](install-flows.md) · [Back to README](../README.md) · [User Interface →](ui.md)

# Engine RPC

The Engine runs in Electron's main process; the UI runs in the renderer. `@ipaforge/rpc` connects them over one message channel. The server side wraps the Engine, and the UI gets an `EngineClient` with the same queries and run handles as the Engine. Both sides validate every message with zod, so a malformed message gets an error back and never crashes either side.

```ts
// Engine side (apps/desktop, main process)
createRpcServer({
  engine,
  transport: messagePortTransport(port),
  resolveIpa,
  logger
})

// UI side
const engine = createEngineClient(transport)
const devices = await engine.listDevices()
const run = engine.installApps({
  udid,
  accountId,
  apps: [{ kind: 'file', path }]
})
run.subscribe((event) => render(event))
const result = await run.result
```

## The channel

A `Transport` sends a message, delivers messages from the other side, reports when either side closes, and closes. Messages are structured-clone values: plain objects, arrays, Maps, Dates and `Uint8Array`s, never functions. Two transports exist:

| Transport | Where | Use |
|---|---|---|
| `createMemoryTransportPair()` | `packages/rpc` | Tests, and running the UI without Electron. It delivers asynchronously and structured-clones every message, like a real port |
| `messagePortTransport(port)` | `apps/desktop/src/main/rpc/` | The main process's end of an Electron `MessageChannelMain`. The port type is structural, so it compiles without the electron package |

The main process creates one `MessageChannelMain` per page load (`serveEngine`) and posts the other end to the page; the preload forwards it with `window.postMessage`, and the renderer wraps it in a `Transport` (`apps/desktop/src/renderer/engine-port.ts`).

### The update channel

Updating IPAForge has a channel of its own beside the Engine's, posted the same way under `ipaforge:updates` (`apps/desktop/src/main/updates/serve-updates.ts`). `serveUpdates(source, transport)` sends the host's `UpdateState` at once and on every change. `createUpdateClient(transport)` is the UI's end: an `UpdateSource` that is `checking` until the first state arrives, with `retry()` as the only message back. Both ends validate with zod (`updateStateSchema`), and links in a state must be HTTPS. The states:

| `phase` | Meaning |
|---|---|
| `idle` | Nothing to do: up to date, offline, or no updater (a browser, a development build) |
| `checking` | Asking GitHub for a newer version |
| `downloading` | `version`, `transferred`, `total`, `bytesPerSecond` |
| `installing` | Downloaded; IPAForge quits, installs it and opens again |
| `failed` | The download failed: `version`, the updater's `reason`, and the release page `url` |
| `manual` | A newer `version` is out but this copy can't install it (`packageType`: `msi`, `deb`, `rpm` or `other`), with the `fileName` to download when known and its `url` |

## Messages

Every message carries `v` (the protocol version, currently `1`). Both sides ship together, so a version mismatch is rejected rather than negotiated.

UI to Engine, each with an `id` that its response echoes:

| `type` | Fields | Engine call |
|---|---|---|
| `query` | `call: { method, args }` | `listDevices`, `deviceStatus`, `deviceApps` (what the on-device checklist needs: LocalDevVPN installed), `revealDeveloperMode` (a one-shot call), `systemCheck` (the setup guide's computer check: the device service, Apple, the clock, the anisette servers), `pairDevice` (waits for the Trust tap, within the request timeout), `listAccounts`, `listTeams`, `catalogApps`, `catalogReleases` (each channel's latest release of a catalog app, from GitHub), `recommendedChannel`, `appIdQuota`, `listCertificates`, `planInstall`, the app sources (`listSources`, `sourceApps`, `checkSource` and `addSource`, both https only, `removeSource`, `setSourceEnabled`, `refreshSources`), the installed apps (`installedApps`, `removeApp`, `refreshPlan`, which asks Apple for the team's certificates), `checkSideStore` (Repair SideStore's check), `codePairedDevices` and `forgetCodePaired` (Apple TVs and Vision Pros paired by code), and `signOut` (a one-shot call answered the same way) |
| `start` | `runId`, `call: { command, input }`, `resume?` | `installSideStore`, `installApps`, `refreshApps` (its `apps` named like installApps', its `profiles` bundle ids), `repairSideStore`, `placePairing`, `signIn`, `pairByCode` (an Apple TV or Vision Pro; its `device.pairing_code` question asks for the code it shows) |
| `answer` | `runId`, `answer` | `handle.answer()` |
| `decline` | `runId` | `handle.decline()` |
| `cancel` | `runId` | `handle.cancel()` |
| `subscribe` | `subscriptionId`, `topic` (`devices`, `pairable` or `logs`) | `engine.watchDevices()`, `engine.watchPairableDevices()`, or the host's log buffer |
| `unsubscribe` | `subscriptionId` | the unsubscribe it returned |
| `logs` | `query: { minLevel?, scopes?, text?, from?, to?, after?, before?, limit? }` | A page of the host's log buffer, filtered and searched there (at most 1,000 entries) |
| `log-level` | `level?` | The level the host records at; with `level`, changes it first |
| `log` | `record` | A record the UI logged, kept with the Engine's if the level would have recorded it |
| `choose-ipas` | | The host's file dialog for IPAs: the files picked, or none |
| `choose-save-folder` | | The host's folder dialog for Save signed .ipa instead: `{ id, name }` of the folder picked, or null |

Engine to UI:

| `type` | Fields | Meaning |
|---|---|---|
| `response` | `id`, `value` | The request succeeded (`value` is the query result) |
| `error` | `id`, `error` | The request failed |
| `run-event` | `runId`, `event` | A pipeline event or a `prompt` |
| `run-result` | `runId`, `result` | The run ended: `completed`, `failed` or `cancelled` |
| `run-error` | `runId`, `error` | The run threw instead of returning a result |
| `subscription-event` | `subscriptionId`, `event` | One event of a live feed (for `devices`: the list, an attach or a detach; for `logs`: `{ type: 'log', entry }`) |

## How a run streams

1. The client picks the `runId` and returns a handle at once, so events are collected even before the server acknowledges the start. A late `subscribe` gets every earlier event replayed, as with the Engine.
2. The server resolves the inputs and starts the command. Events and prompts flow back as `run-event`s. The first is always `run-started`: every step of the run (id and label key), the steps a resumed run already finished, and the progress so far, so the UI can list all steps up front. A step reports what it did with a `step-detail` event (`{ stepId, detail }`, a `StepDetail` from `@ipaforge/installer`, validated by kind: the release found, the session used, the team, the certificate, the App IDs, and so on). The handle's `pending()` shows the waiting prompt, and `answer`, `decline` and `cancel` go back by `runId`. An `AbortSignal` in the options cancels the run as well.
3. The run ends with one `run-result`. A completed state arrives without file handles: a `FileSource` becomes `{ name, size }` (the `Wire<T>` type).
4. A failed or cancelled run's checkpoint stays on the Engine side, because its state holds open files and the UI must not be able to hand the Engine a state of its own. The UI gets `{ id, pipelineId, completed }` and resumes by passing it back as `resume`. A checkpoint resumes only the command that made it, and only once.

## Live feeds

`client.watchDevices(listener)` subscribes to connected devices under an id the client picks and returns the function that unsubscribes. The listener gets `{ type: 'devices', devices }` first, then `attached` / `detached` events, each followed by the new list. Devices found on Wi-Fi by IPAForge itself come the same way (negative device ids). `{ type: 'network', denied }` says when the OS refuses local network access (macOS Local Network), and is sent again to a listener that subscribes later. Events are validated with zod on both sides, like every other message; an event for a subscription the client no longer has is dropped. Subscribing twice under one id is `rpc.invalid_message`; unsubscribing twice is harmless.

`client.watchPairableDevices(listener)` is the pairing dialog's search: `{ type: 'pairable', event }` for each Apple TV or Vision Pro that opens or closes its pairing screen (`found` with its name, model, address and pairing port; `lost`), `denied` when the OS refuses local network access, and `failed` when the search stops. The search runs only while someone subscribes. Devices paired by code come in the device feed with `pairedByCode: true`.

`client.logs` is the log viewer's side: `page(query)` returns `{ entries, hasMore, counts }` (the newest matching entries, oldest first, and the count per level ignoring `minLevel`); `watch(listener)` gets every new entry; `level()` and `setLevel(level)` read and change the level; `write(record)` sends one of the UI's records, fire and forget. The host passes its buffer and level to `createRpcServer({ logs })`; without them the viewer gets empty pages. None of this traffic is logged, and a log entry that fails to send is dropped silently: logging the failure would make the next entry to send.

When the channel closes, the server cancels its runs, ends its subscriptions and forgets its checkpoints. The client rejects everything waiting with `rpc.disconnected` and drops its subscriptions.

`signIn({ appleId })` adds an Apple ID: answer its `apple.password` prompt (and any second factor) through the handle. The password is only ever a prompt answer, never part of a run's input, state or checkpoint.

## IPAs

A `FileSource` cannot cross the channel, so the UI names an IPA instead:

| Source | Resolved by |
|---|---|
| `{ kind: "file", path }` | `resolveIpa`: the desktop opens the file where it is |
| `{ kind: "url", url }` | `resolveIpa`: the desktop downloads it (HTTPS only) into the download cache |
| `{ kind: "catalog", appId, channel? }` | Nobody: the flows download and verify catalog apps themselves |
| `{ kind: "installed", bundleId }` | The Engine (`installedSource`): the app's kept IPA and record, for Refresh |

The UI never sees the file system. To pick IPAs it sends `choose-ipas` and gets back `[{ path, name, size }]` from the host's own file dialog (`createRpcServer({ chooseIpas })`; the desktop app opens it in the main process, bound to the window); without a dialog, or when the user cancels, the answer is empty. A file dropped on the window gets its path from the preload's one function (see [User Interface](ui.md)).

Save signed .ipa instead works the same way the other direction: `choose-save-folder` opens the host's folder dialog (`createRpcServer({ chooseSaveFolder })`), and the server keeps the path and answers with an id and the folder's name. `installApps` names the folder by that id (`save: { folderId, apps }`); the server turns it into the path, and an id it didn't give (or from another connection) is refused with `rpc.invalid_message`. A page can't make a run write anywhere the user didn't pick.

## Errors

Errors cross as serialized `IPAForgeError`s (`toJSON()`) and come back through `IPAForgeError.fromJSON()` with the same code, data and cause chain. `engine.classify(error)` therefore works on the UI side too. The RPC layer adds three codes of its own:

| Code | When |
|---|---|
| `rpc.invalid_message` | A message failed validation, or names an unknown run or checkpoint |
| `rpc.disconnected` | The channel closed while a request or run was waiting |
| `rpc.timeout` | A request got no response within `requestTimeoutMs` (10 minutes by default, since `planInstall` may download an IPA first). Runs have no timeout |

Validation errors list which fields were wrong, never their values, because an answer may be a password.

## See Also

- [Install Flows](install-flows.md): the Engine this bridges
- [Architecture](architecture.md): where `rpc` sits in the dependency rules
