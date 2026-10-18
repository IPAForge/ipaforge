// The app's one stylesheet, as the hosts load it: without it the screens would be unstyled.
import '@ui/styles.css'

import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// The clock every screenshot shows (log times, "next App ID frees on"), so images don't change from day to day.
export const SCREENSHOT_NOW = new Date('2026-10-18T14:02:11.120Z')

const STILL = `*, *::before, *::after {
  animation: none !important;
  transition: none !important;
  caret-color: transparent !important;
}`

configure({ asyncUtilTimeout: 10_000 })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(SCREENSHOT_NOW)
  // Spinners and pulses would make two screenshots of the same screen differ.
  const style = document.createElement('style')
  style.dataset.screenshots = 'still'
  style.textContent = STILL
  document.head.append(style)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  document.head.querySelector('style[data-screenshots]')?.remove()
  localStorage.clear()
  for (const name of ['style', 'class', 'data-theme', 'lang', 'dir'])
    document.documentElement.removeAttribute(name)
})
