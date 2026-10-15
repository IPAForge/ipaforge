import { ByteWriter } from '@loadstar/kernel'
import { alignUp } from '@signer/domain/macho/align.ts'
import {
  FAT_ARCH_SIZE,
  FAT_HEADER_SIZE,
  FAT_MAGIC
} from '@signer/domain/macho/constants.ts'
import type { FatArch } from '@signer/domain/macho/types.ts'

/**
 * Reassemble a universal binary from independently signed slices, keeping each arch's
 * cputype/cpusubtype/align and order (gaps are zero-filled).
 */
export const assembleFat = (
  arches: readonly FatArch[],
  slices: readonly Uint8Array[]
): Uint8Array => {
  let offset = FAT_HEADER_SIZE + FAT_ARCH_SIZE * arches.length
  const placed = arches.map((arch, i) => {
    offset = alignUp(offset, 2 ** arch.align)
    const start = offset
    offset += (slices[i] as Uint8Array).byteLength
    return { arch, start, bytes: slices[i] as Uint8Array }
  })

  const out = new Uint8Array(offset)
  const header = new ByteWriter(FAT_HEADER_SIZE + FAT_ARCH_SIZE * arches.length)
    .u32be(FAT_MAGIC)
    .u32be(arches.length)
  for (const { arch, start, bytes } of placed) {
    header
      .u32be(arch.cputype)
      .u32be(arch.cpusubtype)
      .u32be(start)
      .u32be(bytes.byteLength)
      .u32be(arch.align)
    out.set(bytes, start)
  }
  out.set(header.toBytes(), 0)
  return out
}
