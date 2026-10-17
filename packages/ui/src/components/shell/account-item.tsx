import { PickerItem } from '@ui/components/shell/picker-item.tsx'
import { useAccountView } from '@ui/features/accounts/hooks/use-account-view.ts'
import type { Account } from '@ui/services/engine/types.ts'

type AccountItemProps = { account: Account; udids: readonly string[] }

/** One saved Apple ID in the menu: its teams and its state on the devices in use. */
export const AccountItem = ({ account, udids }: AccountItemProps) => {
  const view = useAccountView(account, udids)

  return (
    <PickerItem
      id={account.id}
      title={account.appleId}
      subtitle={view.subtitle}
      tone={view.tone}
    />
  )
}
