import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// Whole-app tests play a fake install run of fifteen steps; on a busy CI machine that takes more than a second.
configure({ asyncUtilTimeout: 5000 })

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('style')
  document.documentElement.removeAttribute('class')
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('lang')
  document.documentElement.removeAttribute('dir')
})
