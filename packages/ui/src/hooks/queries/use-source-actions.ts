import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@ui/hooks/queries/query-keys.ts'
import { useEngine } from '@ui/hooks/use-engine.ts'

/** Changing app sources: each change refreshes the list and the apps shown in Browse apps. */
export const useSourceActions = () => {
  const engine = useEngine()
  const client = useQueryClient()
  const onSettled = () =>
    client.invalidateQueries({ queryKey: queryKeys.sources })

  return {
    check: useMutation({
      mutationFn: (url: string) => engine.checkSource(url)
    }),
    add: useMutation({
      mutationFn: (url: string) => engine.addSource(url),
      onSettled
    }),
    remove: useMutation({
      mutationFn: (id: string) => engine.removeSource(id),
      onSettled
    }),
    setEnabled: useMutation({
      mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
        engine.setSourceEnabled(id, enabled),
      onSettled
    }),
    refresh: useMutation({
      mutationFn: (id?: string) => engine.refreshSources(id),
      onSettled
    })
  }
}
