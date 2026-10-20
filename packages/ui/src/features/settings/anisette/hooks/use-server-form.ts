import { useState } from 'react'

import { toIPAForgeError } from '@ipaforge/kernel'
import type {
  ServerDialogTarget,
  ServerFormProblems,
  ServerTestState
} from '@ui/features/settings/anisette/types.ts'
import { serverFormProblems } from '@ui/features/settings/anisette/utils/server-form-problems.ts'
import { useAnisetteActions } from '@ui/hooks/queries/use-anisette-actions.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'
import type { AnisetteServerEntry } from '@ui/services/engine/types.ts'

/** What the Engine said to a save it refused, as the field's problem. */
const engineProblem = (error: unknown): ServerFormProblems =>
  toIPAForgeError(error).code === 'apple.anisette_server_exists'
    ? { address: 'settings.anisette.dialog.exists' }
    : { address: 'settings.anisette.dialog.addressInvalid' }

/**
 * The Add or Edit server form: the name and address, their problems once the user tries to test or save, the
 * dialog's own test, and the save (adding a server makes it the one used).
 */
export const useServerForm = (
  target: ServerDialogTarget,
  servers: readonly AnisetteServerEntry[],
  onSaved: (address: string, test: ServerTestState | undefined) => void
) => {
  const engine = useEngine()
  const { add, update } = useAnisetteActions()
  const editing = target.mode === 'edit' ? target.server : undefined
  const [name, setName] = useState(editing?.name ?? '')
  const [address, setAddress] = useState(editing?.address ?? '')
  const [problems, setProblems] = useState<ServerFormProblems>({})
  const [test, setTest] = useState<ServerTestState>()
  const check = () => {
    const found = serverFormProblems(name, address, servers, editing?.address)
    setProblems(found)
    return found
  }

  return {
    name,
    address,
    problems,
    test,
    isSaving: add.isPending || update.isPending,
    onNameChange: (value: string) => {
      setName(value)
      setProblems(({ address: kept }) => (kept ? { address: kept } : {}))
    },
    onAddressChange: (value: string) => {
      setAddress(value)
      setTest(undefined)
      setProblems(({ name: kept }) => (kept ? { name: kept } : {}))
    },
    onTest: () => {
      if (check().address) return
      setTest({ phase: 'testing' })
      engine.testAnisetteServer(address.trim()).then(
        (result) =>
          setTest(
            result.ok && result.latencyMs !== undefined
              ? { phase: 'ok', latencyMs: result.latencyMs }
              : { phase: 'bad' }
          ),
        () => setTest({ phase: 'bad' })
      )
    },
    onSave: () => {
      const found = check()
      if (found.name || found.address) return
      const input = { name: name.trim(), address: address.trim() }
      const options = {
        onSuccess: () => onSaved(input.address, test),
        onError: (error: unknown) => setProblems(engineProblem(error))
      }
      if (editing) update.mutate({ ...input, from: editing.address }, options)
      else add.mutate(input, options)
    }
  }
}
