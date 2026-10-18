// Electron hardening that applies to every web contents: the window shows the bundled UI and nothing else.

import type { Session, WebContents } from 'electron'

import { allowedPermissions } from '@desktop/main/constants.ts'
import { isAllowedExternalLink } from '@desktop/main/external-links.ts'
import type { Logger } from '@ipaforge/kernel'

/**
 * No pop-ups and no navigation away from the UI. A page the UI asks to open (`window.open`) goes to the default
 * browser when it is on the allowed list (`constants.ts`), and nowhere otherwise; never a new window.
 */
export const lockDownWebContents = (
  contents: WebContents,
  logger: Logger,
  openExternal: (url: string) => Promise<void>
): void => {
  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalLink(url)) {
      logger.info('opened a link in the browser', { url: new URL(url).origin })
      openExternal(url).catch((error: unknown) =>
        logger.warn('could not open a link in the browser', { error })
      )
    } else logger.warn('blocked a new window', { url })
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event) => {
    logger.warn('blocked a navigation', { url: event.url })
    event.preventDefault()
  })
  contents.on('will-attach-webview', (event) => {
    logger.warn('blocked a webview')
    event.preventDefault()
  })
}

/**
 * The UI needs no camera, microphone, notifications or other permission: every request is refused except
 * writing to the clipboard (`allowedPermissions`).
 */
export const restrictPermissions = (session: Session, logger: Logger): void => {
  session.setPermissionRequestHandler((_contents, permission, callback) => {
    const isAllowed = allowedPermissions.has(permission)
    if (!isAllowed) logger.warn('denied a permission request', { permission })
    callback(isAllowed)
  })
  session.setPermissionCheckHandler((_contents, permission) =>
    allowedPermissions.has(permission)
  )
}
