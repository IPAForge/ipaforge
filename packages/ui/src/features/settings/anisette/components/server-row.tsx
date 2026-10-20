import { Button } from '@heroui/react'
import { Activity, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { RemoveConfirm } from '@ui/features/settings/anisette/components/remove-confirm.tsx'
import { ServerLead } from '@ui/features/settings/anisette/components/server-lead.tsx'
import { ServerStatus } from '@ui/features/settings/anisette/components/server-status.tsx'
import type { ServerTestState } from '@ui/features/settings/anisette/types.ts'
import type { AnisetteServerEntry } from '@ui/services/engine/types.ts'

type ServerRowProps = {
  server: AnisetteServerEntry
  position: number | undefined
  markKey:
    | 'settings.anisette.tag.inUse'
    | 'settings.anisette.tag.chosen'
    | undefined
  isSelected: boolean
  test: ServerTestState | undefined
  isRemoving: boolean
  onTest: (address: string) => void
  onEdit: (server: AnisetteServerEntry) => void
  onRemove: (address: string) => void
}

/** One server: its place or radio, name and address, its last test, and Test (Edit and Remove for yours). */
export const ServerRow = ({
  server,
  position,
  markKey,
  isSelected,
  test,
  isRemoving,
  onTest,
  onEdit,
  onRemove
}: ServerRowProps) => {
  const { t } = useTranslation()
  const [isConfirming, setIsConfirming] = useState(false)
  const isOwn = server.source === 'custom'
  const onTestPress = () => onTest(server.address)
  const onEditPress = () => onEdit(server)
  const onRemovePress = () => setIsConfirming(true)
  const onCancelRemove = () => setIsConfirming(false)
  const onConfirmRemove = () => onRemove(server.address)

  return (
    <li
      className={`grid grid-cols-[minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-border border-t px-3.5 py-2.5 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] ${isSelected ? 'bg-accent-soft' : ''}`}
    >
      <ServerLead server={server} position={position} markKey={markKey} />
      <span className="ps-10 sm:ps-0">
        <ServerStatus state={test} />
      </span>
      <span className="flex gap-0.5 ps-9 sm:ps-0">
        <Button
          size="sm"
          variant="ghost"
          aria-label={t('settings.anisette.testOne', { name: server.name })}
          isDisabled={test?.phase === 'testing'}
          onPress={onTestPress}
        >
          <Activity aria-hidden="true" className="size-4" />
          {t('settings.anisette.test')}
        </Button>
        {isOwn ? (
          <>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={t('settings.anisette.edit', { name: server.name })}
              onPress={onEditPress}
            >
              <Pencil aria-hidden="true" className="size-4" />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={t('settings.anisette.remove', { name: server.name })}
              onPress={onRemovePress}
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          </>
        ) : null}
      </span>
      {isConfirming ? (
        <RemoveConfirm
          name={server.name}
          isPending={isRemoving}
          onRemove={onConfirmRemove}
          onCancel={onCancelRemove}
        />
      ) : null}
    </li>
  )
}
