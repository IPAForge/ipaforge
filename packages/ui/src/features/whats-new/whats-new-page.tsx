import { PageHeader } from '@ui/components/page-header.tsx'
import { EnglishOnlyNote } from '@ui/features/whats-new/components/english-only-note.tsx'
import { ReleaseArticle } from '@ui/features/whats-new/components/release-article.tsx'
import { RELEASE_NOTES } from '@ui/features/whats-new/constants.ts'
import { useUiServices } from '@ui/hooks/use-ui-services.ts'

/** The changelog: what changed in every version, newest first, the one IPAForge runs marked. */
export const WhatsNewPage = () => {
  const { appVersion } = useUiServices()

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <PageHeader
          titleKey="whatsNew.page.title"
          descriptionKey="whatsNew.page.lede"
        />
        <EnglishOnlyNote />
      </div>
      {RELEASE_NOTES.map((notes) => (
        <ReleaseArticle
          key={notes.version}
          notes={notes}
          isCurrent={notes.version === appVersion}
        />
      ))}
    </div>
  )
}
