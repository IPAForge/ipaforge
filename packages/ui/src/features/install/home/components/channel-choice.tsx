import {
  Label,
  RadioButton,
  RadioField,
  RadioGroup
} from 'react-aria-components'
import { useTranslation } from 'react-i18next'

import { segmentClass } from '@ui/features/install/home/utils/choice-classes.ts'
import { isChannel } from '@ui/features/install/home/utils/is-choice.ts'
import { channels } from '@ui/services/engine/constants.ts'
import type { Channel } from '@ui/services/engine/types.ts'

type ChannelChoiceProps = {
  value: Channel
  /** The channel the catalog recommends for the device's iOS, said in its label. */
  recommended: Channel | undefined
  onChange: (channel: Channel) => void
}

/** Stable or Nightly as a segmented switch: the chosen one is filled in the accent colour. */
export const ChannelChoice = ({
  value,
  recommended,
  onChange
}: ChannelChoiceProps) => {
  const { t } = useTranslation()
  const onValueChange = (next: string) => {
    if (isChannel(next)) onChange(next)
  }

  return (
    <RadioGroup
      value={value}
      onChange={onValueChange}
      orientation="horizontal"
      className="flex flex-wrap items-center gap-3"
    >
      <Label className="font-medium text-sm">{t('install.home.channel')}</Label>
      <div className="flex rounded-full bg-surface-secondary p-1">
        {channels.map((channel) => (
          <RadioField key={channel} value={channel}>
            <RadioButton className={segmentClass}>
              {t(
                channel === recommended
                  ? `install.channel.${channel}Recommended`
                  : `install.channel.${channel}`
              )}
            </RadioButton>
          </RadioField>
        ))}
      </div>
    </RadioGroup>
  )
}
