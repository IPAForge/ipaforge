import { Label, Radio, RadioGroup } from 'react-aria-components'
import { useTranslation } from 'react-i18next'

import { type Channel, channels } from '@ui/services/engine/engine-types.ts'

type SegmentClassOptions = {
  isSelected: boolean
  isFocusVisible: boolean
}

const segmentClass = ({
  isSelected,
  isFocusVisible
}: SegmentClassOptions): string =>
  [
    'cursor-pointer rounded-full px-4 py-1.5 text-sm transition-colors',
    isSelected
      ? 'bg-accent font-medium text-accent-foreground shadow-sm'
      : 'text-muted hover:text-foreground',
    isFocusVisible ? 'outline-2 outline-accent outline-offset-2' : ''
  ].join(' ')

const isChannel = (value: string): value is Channel =>
  (channels as readonly string[]).includes(value)

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
          <Radio key={channel} value={channel} className={segmentClass}>
            {t(
              channel === recommended
                ? `install.channel.${channel}Recommended`
                : `install.channel.${channel}`
            )}
          </Radio>
        ))}
      </div>
    </RadioGroup>
  )
}
