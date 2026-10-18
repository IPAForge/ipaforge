import { Kbd, SearchField } from '@heroui/react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

type LogSearchProps = { value: string; onChange: (value: string) => void }

/** Searches messages and details (in the Engine); `/` focuses it from anywhere on the page. */
export const LogSearch = ({ value, onChange }: LogSearchProps) => {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'
      if (event.key !== '/' || isTyping) return
      event.preventDefault()
      input.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <SearchField
      aria-label={t('logs.search.label')}
      value={value}
      onChange={onChange}
      className="min-w-48 flex-1"
    >
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input
          ref={input}
          placeholder={t('logs.search.placeholder')}
        />
        <SearchField.ClearButton />
        {value ? null : (
          <Kbd aria-hidden="true" className="me-2">
            {t('logs.search.key')}
          </Kbd>
        )}
      </SearchField.Group>
    </SearchField>
  )
}
