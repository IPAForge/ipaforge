// Which developer-services resources a device belongs to, from lockdownd's `DeviceClass`: an Apple TV is registered
// and provisioned under `tvos/`; iPhone, iPad and Vision Pro (which runs iPhone and iPad apps) under `ios/`.
import type { DevicePlatform } from '@ipaforge/apple'

const APPLE_TV_CLASS = 'AppleTV'

export const devicePlatform = (
  device: { readonly deviceClass: string } | undefined
): DevicePlatform => (device?.deviceClass === APPLE_TV_CLASS ? 'tvos' : 'ios')
