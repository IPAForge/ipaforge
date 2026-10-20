import { Button, Card, Spinner } from '@heroui/react'
import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ChoiceNotice } from '@ui/features/settings/anisette/components/choice-notice.tsx'
import { ListBar } from '@ui/features/settings/anisette/components/list-bar.tsx'
import { ModeSwitch } from '@ui/features/settings/anisette/components/mode-switch.tsx'
import { ServerDialog } from '@ui/features/settings/anisette/components/server-dialog.tsx'
import { ServerList } from '@ui/features/settings/anisette/components/server-list.tsx'
import { SkippedNote } from '@ui/features/settings/anisette/components/skipped-note.tsx'
import { ANISETTE_CARD_ID } from '@ui/features/settings/anisette/constants.ts'
import { useCardHighlight } from '@ui/features/settings/anisette/hooks/use-card-highlight.ts'
import { useServerTests } from '@ui/features/settings/anisette/hooks/use-server-tests.ts'
import type {
  ServerDialogTarget,
  ServerTestState
} from '@ui/features/settings/anisette/types.ts'
import { useAnisetteActions } from '@ui/hooks/queries/use-anisette-actions.ts'
import { useAnisetteServers } from '@ui/hooks/queries/use-anisette-servers.ts'
import type {
  AnisetteChoice,
  AnisetteServerEntry
} from '@ui/services/engine/types.ts'

/**
 * Anisette servers: Automatic (the servers in order, moving on when one fails) or one chosen server, the servers
 * the user added first, then SideStore's list, then the built-in backup; each can be tested, and the user's own
 * added, edited and removed.
 */
export const AnisetteSettings = () => {
  const { t } = useTranslation()
  const card = useRef<HTMLDivElement>(null)
  const isHighlighted = useCardHighlight(card)
  const servers = useAnisetteServers()
  const actions = useAnisetteActions()
  const tests = useServerTests()
  const [dialog, setDialog] = useState<ServerDialogTarget>()
  const overview = servers.data
  const isTesting = Object.values(tests.states).some(
    (state) => state.phase === 'testing'
  )
  const onMode = (mode: AnisetteChoice['mode']) =>
    actions.choose.mutate(mode === 'automatic' ? { mode } : { mode: 'chosen' })
  const onChoose = (server: AnisetteServerEntry) =>
    actions.choose.mutate({
      mode: 'chosen',
      server: { name: server.name, address: server.address }
    })
  const onAdd = () => setDialog({ mode: 'add' })
  const onEdit = (server: AnisetteServerEntry) =>
    setDialog({ mode: 'edit', server })
  const onClose = () => setDialog(undefined)
  const onSaved = (address: string, test: ServerTestState | undefined) => {
    if (test && test.phase !== 'testing') tests.record(address, test)
    setDialog(undefined)
  }
  const onRemove = (address: string) => actions.remove.mutate(address)
  const onUpdate = () => actions.updateList.mutate()
  const onTestAll = () =>
    tests.testAll(overview?.servers.map((server) => server.address) ?? [])

  return (
    <Card
      ref={card}
      id={ANISETTE_CARD_ID}
      role="region"
      aria-labelledby={`${ANISETTE_CARD_ID}-title`}
      className={`scroll-mt-6 transition-shadow ${isHighlighted ? 'ring-2 ring-accent' : ''}`}
    >
      <Card.Content className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-1.5">
            <h2
              id={`${ANISETTE_CARD_ID}-title`}
              className="font-semibold text-lg"
            >
              {t('settings.anisette.title')}
            </h2>
            <p className="max-w-prose text-muted text-sm">
              {t('settings.anisette.hint')}
            </p>
          </div>
          <Button onPress={onAdd}>
            <Plus aria-hidden="true" className="size-4" />
            {t('settings.anisette.add')}
          </Button>
        </div>
        {overview ? (
          <>
            <ModeSwitch choice={overview.choice} onChange={onMode} />
            <ChoiceNotice choice={overview.choice} tests={tests} />
            <ListBar
              overview={overview}
              isUpdating={actions.updateList.isPending}
              isTesting={isTesting}
              onUpdate={onUpdate}
              onTestAll={onTestAll}
            />
            <ServerList
              overview={overview}
              tests={tests}
              removing={
                actions.remove.isPending ? actions.remove.variables : undefined
              }
              onChoose={onChoose}
              onEdit={onEdit}
              onRemove={onRemove}
            />
            <SkippedNote names={overview.skipped} />
          </>
        ) : (
          <p
            className="flex items-center gap-2 text-muted text-sm"
            role="status"
          >
            <Spinner size="sm" />
            {t('settings.anisette.loading')}
          </p>
        )}
      </Card.Content>
      {dialog && overview ? (
        <ServerDialog
          target={dialog}
          servers={overview.servers}
          onSaved={onSaved}
          onClose={onClose}
        />
      ) : null}
    </Card>
  )
}
