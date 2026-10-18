import { ISSUES_URL } from '@ui/features/install/recovery/constants.ts'

/**
 * A GitHub "new issue" link with the title and text filled in: a line for what the user was doing, then the
 * diagnostics (which hold no Apple ID, name or serial). GitHub shows it for review; nothing is sent until the
 * user submits it. In English, since it is for maintainers.
 */
export const issueUrl = (title: string, diagnostics: string): string => {
  const body = [
    '**What happened**',
    '',
    '<!-- What were you doing when it failed? -->',
    '',
    '**Diagnostics**',
    '',
    '```',
    diagnostics,
    '```'
  ].join('\n')
  const query = new URLSearchParams({ title, body })

  return `${ISSUES_URL}/new?${query.toString()}`
}
