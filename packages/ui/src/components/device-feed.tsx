import { useDeviceFeed } from '@ui/hooks/queries/use-device-feed.ts'

/** Renders nothing: keeps the device queries in step with the Engine's device feed for the whole app. */
export const DeviceFeed = () => {
  useDeviceFeed()
  return null
}
