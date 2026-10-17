// The only import of node-forge, typed with just the slice this module uses. @types/node-forge is not used
// because it pulls Node's global types into this platform-free package. node-forge works on "binary
// strings" (one char per byte); conversion to and from Uint8Array happens at the module's edge.
// @ts-expect-error -- node-forge ships no type declarations; `Forge` below describes what is used.
import untypedForge from 'node-forge'

import type { Forge } from '@signer/infrastructure/pkcs12/types.ts'

export const forge = untypedForge as Forge
