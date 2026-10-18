import { allowedExternalLinks } from '@desktop/main/constants.ts'

/** The page is the allowed path or below it ("/" allows the whole origin). */
const isUnder = (pathname: string, path: string): boolean =>
  path === '/' || pathname === path || pathname.startsWith(`${path}/`)

/** Whether the UI may open `url` in the browser: HTTPS, an allowed origin, no credentials, under an allowed path. */
export const isAllowedExternalLink = (url: string): boolean => {
  if (!URL.canParse(url)) return false
  const { origin, pathname, username, password } = new URL(url)
  if (username || password) return false

  return allowedExternalLinks.some(
    (link) => origin === link.origin && isUnder(pathname, link.path)
  )
}
