import { PlaceholderPage } from '@ui/components/placeholder-page.tsx'
import { EngineStatus } from '@ui/features/devices/engine-status.tsx'

/** Devices: whether the Engine is connected and sees devices, until the device list lands. */
export const DevicesPage = () => (
  <PlaceholderPage titleKey="nav.devices">
    <EngineStatus />
  </PlaceholderPage>
)
