import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'
import type {
  AnisetteChoice,
  AnisetteOverview
} from '@ui/services/engine/types.ts'

type ServerInput = { readonly name: string; readonly address: string }

/** Changing the anisette servers: each change answers with the servers after it, which replace the cached ones. */
export const useAnisetteActions = () => {
  const engine = useEngine()
  const client = useQueryClient()
  const onSuccess = (overview: AnisetteOverview) =>
    client.setQueryData(queryKeys.anisette, overview)

  return {
    choose: useMutation({
      mutationFn: (choice: AnisetteChoice) =>
        engine.chooseAnisetteServer(choice),
      onSuccess
    }),
    add: useMutation({
      mutationFn: (input: ServerInput) => engine.addAnisetteServer(input),
      onSuccess
    }),
    update: useMutation({
      mutationFn: ({
        from,
        name,
        address
      }: ServerInput & { readonly from: string }) =>
        engine.updateAnisetteServer(from, { name, address }),
      onSuccess
    }),
    remove: useMutation({
      mutationFn: (address: string) => engine.removeAnisetteServer(address),
      onSuccess
    }),
    updateList: useMutation({
      mutationFn: () => engine.updateAnisetteServerList(),
      onSuccess
    })
  }
}
