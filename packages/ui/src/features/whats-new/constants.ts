import { LINK_CLASSES } from '@ui/components/shell/constants.ts'
import type { NoteKind, ReleaseNotes } from '@ui/features/whats-new/types.ts'
import type { TranslationKey } from '@ui/i18n/setup/types.ts'

/** IPAForge's releases on GitHub, each version's under `tag/v<version>`. */
export const RELEASES_URL = 'https://github.com/IPAForge/ipaforge/releases'

/** The changelog page. */
export const WHATS_NEW_PATH = '/whats-new'

/** The last version whose What's new was shown (or skipped, on a first launch). */
export const WHATS_NEW_SEEN_KEY = 'whatsNew.seen'

/** Each kind's tag. */
export const noteKindKeys = {
  new: 'whatsNew.kind.new',
  changed: 'whatsNew.kind.changed',
  fixed: 'whatsNew.kind.fixed',
  removed: 'whatsNew.kind.removed'
} as const satisfies Record<NoteKind, TranslationKey>

/** The sections a version's notes are shown in, in this order. */
export const NOTE_KINDS: readonly NoteKind[] = [
  'new',
  'changed',
  'fixed',
  'removed'
]

/** Each section's dot beside its heading. */
export const noteKindDots = {
  new: 'bg-success',
  changed: 'bg-accent',
  fixed: 'bg-warning',
  removed: 'bg-danger'
} as const satisfies Record<NoteKind, string>

/**
 * Every version's notes, newest first, in plain words: what a user notices, not how it was built. English only.
 * Add the new version's notes here with its release (docs/releases/<version>.md has the longer ones).
 */
export const RELEASE_NOTES: readonly ReleaseNotes[] = [
  {
    version: '0.1.0-alpha.5',
    date: '2026-10-20',
    lead: 'IPAForge has a home of its own, and stays open source for good.',
    items: [
      {
        kind: 'new',
        title: 'A website',
        text: 'ipaforge.github.io: what IPAForge does, the downloads, and a Discord to ask for help.'
      },
      {
        kind: 'changed',
        text: 'IPAForge moves to github.com/IPAForge/ipaforge, and updates itself from there. Old links still work.'
      },
      {
        kind: 'changed',
        text: 'IPAForge is now under the GNU AGPL-3.0: free to use, change and share, and anything built from it must stay open source too.'
      }
    ]
  },
  {
    version: '0.1.0-alpha.4',
    date: '2026-10-20',
    lead: 'SideStore looks after itself better, IPAForge keeps itself up to date, and installing over Wi-Fi is faster.',
    items: [
      {
        kind: 'new',
        title: 'Repair SideStore',
        text: "From SideStore's row in Apps: IPAForge checks what keeps it from refreshing your apps by itself (its certificate, its pairing file, when it expires) and fixes it in one go."
      },
      {
        kind: 'new',
        title: 'QR codes for SideStore',
        text: 'Add a source you added here to SideStore on your iPhone by scanning a code, or have SideStore install an app itself.'
      },
      {
        kind: 'new',
        title: 'A checklist for each iPhone',
        text: 'On the Devices page: what it needs for its iOS version, ticked as you go.'
      },
      {
        kind: 'new',
        title: 'Automatic updates',
        text: "IPAForge updates itself when it opens, then tells you what's new. Copies installed from a .msi, .deb or .rpm say when a new version is out."
      },
      {
        kind: 'changed',
        text: 'Sending apps to your iPhone over Wi-Fi is about twice as fast.'
      },
      {
        kind: 'changed',
        text: "Every app in Browse apps opens its details when you click its card, the IPAForge catalog's too."
      },
      {
        kind: 'changed',
        text: 'When an app is in several sources, IPAForge picks the one with the version on your iPhone, never an older one.'
      },
      {
        kind: 'fixed',
        text: "LiveContainer's apps can use its keychain again after installing it with IPAForge."
      },
      {
        kind: 'fixed',
        text: 'When Apple counts a negative number of App IDs left (a glitch on its side), you can try anyway.'
      }
    ]
  },
  {
    version: '0.1.0-alpha.3',
    date: '2026-10-19',
    lead: "Your apps don't expire on you anymore.",
    items: [
      {
        kind: 'new',
        title: 'Apps',
        text: 'Every app on your iPhone signed with your Apple ID, when it expires, and Refresh, Update and Remove. IPAForge refreshes them by itself before they expire.'
      },
      {
        kind: 'new',
        title: 'Refresh like SideStore',
        text: 'While your certificate is valid an app only gets a new profile, so nothing is installed again.'
      },
      {
        kind: 'new',
        title: 'App sources',
        text: 'Sources in the AltStore format, with Browse apps to search every one of them.'
      },
      {
        kind: 'new',
        title: 'Install progress in detail',
        text: 'Speed and time left for every transfer, and what Apple and iOS are doing.'
      },
      { kind: 'changed', text: 'All six languages were reviewed.' }
    ]
  },
  {
    version: '0.1.0-alpha.2',
    date: '2026-10-19',
    lead: 'The Mac app opens reliably.',
    items: [
      {
        kind: 'new',
        text: 'A signature for every download, a .msi installer for Windows, and Linux packages for Arm.'
      },
      {
        kind: 'fixed',
        text: "The Mac app didn't open for some people, and asked for the keychain too often."
      }
    ]
  },
  {
    version: '0.1.0-alpha.1',
    date: '2026-10-18',
    lead: 'The first alpha.',
    items: [
      {
        kind: 'new',
        text: 'Install SideStore, preload your own apps, sign in with Apple IDs, and see what to do when something fails. In six languages.'
      }
    ]
  }
]

/** A sidebar link with less room between its parts, so the name and the whole version fit on one line. */
export const WHATS_NEW_LINK_CLASSES = LINK_CLASSES.replace('gap-3', 'gap-2')
