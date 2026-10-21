import { useTranslation } from 'react-i18next'

import type { aroundCards } from '@ui/features/guide/constants.ts'

type AroundCardProps = { id: (typeof aroundCards)[number] }

/** One part of IPAForge on the last step: its name, what it's for, and where it is. */
export const AroundCard = ({ id }: AroundCardProps) => {
  const { t } = useTranslation()

  return (
    <li className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-semibold">{t(`guide.around.${id}.title`)}</h2>
      <p className="text-muted text-sm">{t(`guide.around.${id}.text`)}</p>
      <p className="mt-auto pt-1 text-muted text-xs">
        {t(`guide.around.${id}.where`)}
      </p>
    </li>
  )
}
