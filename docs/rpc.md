[← Install Flows](install-flows.md) · [Back to README](../README.md) · [User Interface →](ui.md)

# Engine RPC

The Engine runs in Electron's main process; the UI runs in the renderer. `@loadstar/rpc` connects them over one message channel. The server side wraps the Engine, and the UI gets an `EngineClient` with the same queries and run handles as the Engine. Both sides validate every message with zod, so a malformed message gets an error back and never crashes either side.

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

The renderer's end of the port is wired in Phase 9, when the preload exposes it.

## Messages

Every message carries `v` (the protocol version, currently `1`). Both sides ship together, so a version mismatch is rejected rather than negotiated.

UI to Engine, each with an `id` that its response echoes:

| `type` | Fields | Engine call |
|---|---|---|
| `query` | `call: { method, args }` | `listDevices`, `deviceStatus`, `listAccounts`, `listTeams`, `catalogApps`, `recommendedChannel`, `appIdQuota`, `listCertificates`, `planInstall` |
| `start` | `runId`, `call: { command, input }`, `resume?` | `installSideStore`, `installApps`, `placePairing` |
| `answer` | `runId`, `answer` | `handle.answer()` |
| `decline` | `runId` | `handle.decline()` |
| `cancel` | `runId` | `handle.cancel()` |

Engine to UI:

| `type` | Fields | Meaning |
|---|---|---|
| `response` | `id`, `value` | The request succeeded (`value` is the query result) |
| `error` | `id`, `error` | The request failed |
| `run-event` | `runId`, `event` | A pipeline event or a `prompt` |
| `run-result` | `runId`, `result` | The run ended: `completed`, `failed` or `cancelled` |
| `run-error` | `runId`, `error` | The run threw instead of returning a result |

## How a run streams

1. The client picks the `runId` and returns a handle at once, so events are collected even before the server acknowledges the start. A late `subscribe` gets every earlier event replayed, as with the Engine.
2. The server resolves the inputs and starts the command. Events and prompts flow back as `run-event`s. The handle's `pending()` shows the waiting prompt, and `answer`, `decline` and `cancel` go back by `runId`. An `AbortSignal` in the options cancels the run as well.
3. The run ends with one `run-result`. A completed state arrives without file handles: a `FileSource` becomes `{ name, size }` (the `Wire<T>` type).
4. A failed or cancelled run's checkpoint stays on the Engine side, because its state holds open files and the UI must not be able to hand the Engine a state of its own. The UI gets `{ id, pipelineId, completed }` and resumes by passing it back as `resume`. A checkpoint resumes only the command that made it, and only once.

When the channel closes, the server cancels its runs and forgets their checkpoints. The client rejects everything waiting with `rpc.disconnected`.

## IPAs

A `FileSource` cannot cross the channel, so the UI names an IPA instead:

| Source | Resolved by |
|---|---|
| `{ kind: "file", path }` | `resolveIpa`: the desktop opens the file where it is |
| `{ kind: "url", url }` | `resolveIpa`: the desktop downloads it (HTTPS only) into the download cache |
| `{ kind: "catalog", appId, channel? }` | Nobody: the flows download and verify catalog apps themselves |

## Errors

Errors cross as serialized `LoadstarError`s (`toJSON()`) and come back through `LoadstarError.fromJSON()` with the same code, data and cause chain. `engine.classify(error)` therefore works on the UI side too. The RPC layer adds three codes of its own:

| Code | When |
|---|---|
| `rpc.invalid_message` | A message failed validation, or names an unknown run or checkpoint |
| `rpc.disconnected` | The channel closed while a request or run was waiting |
| `rpc.timeout` | A request got no response within `requestTimeoutMs` (10 minutes by default, since `planInstall` may download an IPA first). Runs have no timeout |

Validation errors list which fields were wrong, never their values, because an answer may be a password.

## See Also

- [Install Flows](install-flows.md): the Engine this bridges
- [Architecture](architecture.md): where `rpc` sits in the dependency rules
