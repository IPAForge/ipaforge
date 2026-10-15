import * as asn1js from 'asn1js'
import { describe, expect, it } from 'vitest'

import { WWDR_MARKER_OID } from '@signer/domain/blobs/requirements.ts'
import { OID_APPLE_WWDR_INTERMEDIATE } from '@signer/infrastructure/cms/oids.ts'

describe('oids', () => {
  it("the designated requirement's WWDR marker bytes encode OID_APPLE_WWDR_INTERMEDIATE", () => {
    const encoded = new asn1js.ObjectIdentifier({
      value: OID_APPLE_WWDR_INTERMEDIATE
    }).valueBlock.toBER(false)
    expect([...new Uint8Array(encoded)]).toEqual([...WWDR_MARKER_OID])
  })
})
