// Builds an Engine over the fakes and answers prompts from a script.
import {
  type FakeAppleOptions,
  type FakeDeviceOptions,
  fakeApple,
  fakeCatalog,
  fakeDevices,
  fakeSigner,
  memoryScratch,
  memorySecrets
} from '@installer/__tests__/fakes.ts'
import { createEngine } from '@installer/engine.ts'
import type { PromptHandler, PromptRequest } from '@installer/pipeline/types.ts'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

export type HarnessOptions = {
  readonly device?: FakeDeviceOptions
  readonly apple?: FakeAppleOptions
  readonly signerIds?: Readonly<Record<string, string>>
}

export const createHarness = (options: HarnessOptions = {}) => {
  const devices = fakeDevices(options.device)
  const apple = fakeApple(options.apple)
  const catalog = fakeCatalog()
  const signer = fakeSigner(options.signerIds)
  const secrets = memorySecrets()
  const scratch = memoryScratch()
  // Save signed .ipa instead: what was written, by folder and name.
  const saved: { folder: string; name: string; bytes: Uint8Array }[] = []
  const signedIpaFolder = {
    save: async (
      folder: string,
      name: string,
      stream: ReadableStream<Uint8Array>
    ) => {
      saved.push({ folder, name, bytes: await new Response(stream).bytes() })
      return `${folder}/${name}`
    }
  }
  const engine = createEngine({
    devices: devices.manager,
    apple: apple.apple,
    catalog: catalog.catalog,
    secrets,
    scratch,
    signer: signer.signer,
    signedIpaFolder
  })

  return { engine, devices, apple, catalog, signer, secrets, scratch, saved }
}

export type Answers = Readonly<
  Record<string, (request: PromptRequest) => unknown>
>

/** Answers each prompt by kind and records it; an unexpected prompt is declined. */
export const scripted = (
  answers: Answers = {}
): PromptHandler & { readonly asked: PromptRequest[] } => {
  const asked: PromptRequest[] = []
  const handler = async (request: PromptRequest) => {
    asked.push(request)
    const answer = answers[request.kind]
    if (!answer)
      throw new IPAForgeError(ErrorCode.PromptCancelled, {
        message: `unexpected ${request.kind}`
      })
    return answer(request)
  }

  return Object.assign(handler, { asked })
}
