/** The setup guide's steps, in order. */
export const guideSteps = ['welcome', 'computer', 'iphone', 'appleid'] as const

/** Each step's name in the steps list. */
export const guideStepLabelKeys = {
  welcome: 'guide.steps.welcome',
  computer: 'guide.steps.computer',
  iphone: 'guide.steps.iphone',
  appleid: 'guide.steps.appleid'
} as const

/** The fix for a missing device service, by the computer's system: what to do, and a command to copy (Linux). */
export const deviceServiceFixKeys = {
  mac: 'guide.computer.service.fixMac',
  windows: 'guide.computer.service.fixWindows',
  linux: 'guide.computer.service.fixLinux'
} as const

export const LINUX_SERVICE_COMMAND = 'sudo apt install usbmuxd'

/** Apple Devices in the Microsoft Store: it brings the driver that talks to iPhones. */
export const APPLE_DEVICES_STORE_URL =
  'https://apps.microsoft.com/detail/9np83lwlpz9k'

/** How each check's state looks: its mark and colours. */
export const checkLooks = {
  ok: { mark: '✓', classes: 'bg-success-soft text-success-soft-foreground' },
  problem: { mark: '!', classes: 'bg-danger-soft text-danger-soft-foreground' },
  waiting: { mark: '…', classes: 'bg-surface-tertiary text-muted' }
} as const

/** How the iPhone step shows each device state. */
export const deviceCheckStates = {
  checking: 'waiting',
  ready: 'ok',
  locked: 'problem',
  developerModeOff: 'problem',
  notTrusted: 'problem',
  unavailable: 'problem',
  notConnected: 'waiting'
} as const
