import type { Manifest } from '@catalog/domain/types.ts'
// Built-in fallback for when the remote manifest cannot be fetched. Must equal catalog/sources.json (a test checks).

export const DEFAULT_MANIFEST: Manifest = {
  version: 1,
  apps: [
    {
      id: 'sidestore',
      name: 'SideStore',
      bundleId: 'com.SideStore.SideStore',
      kind: 'sidestore',
      minimumIos: '15.0',
      channels: {
        stable: {
          github: {
            repo: 'SideStore/SideStore',
            asset: 'SideStore.ipa'
          }
        },
        nightly: {
          github: {
            repo: 'SideStore/SideStore',
            tag: 'nightly',
            asset: 'SideStore.ipa'
          }
        }
      }
    },
    {
      id: 'livecontainer-sidestore',
      name: 'LiveContainer + SideStore',
      bundleId: 'com.kdt.livecontainer',
      kind: 'livecontainer-sidestore',
      minimumIos: '15.0',
      channels: {
        stable: {
          github: {
            repo: 'LiveContainer/LiveContainer',
            asset: 'LiveContainer+SideStore.ipa'
          },
          mirrors: [
            {
              github: {
                repo: 'LiveContainerMirror/LiveContainer',
                asset: 'LiveContainer+SideStore.ipa'
              }
            }
          ]
        },
        nightly: {
          github: {
            repo: 'LiveContainer/LiveContainer',
            tag: 'nightly',
            asset: 'LiveContainer+SideStore.ipa'
          },
          mirrors: [
            {
              github: {
                repo: 'LiveContainerMirror/LiveContainer',
                tag: 'nightly',
                asset: 'LiveContainer+SideStore.ipa'
              }
            }
          ]
        }
      }
    },
    {
      id: 'livecontainer',
      name: 'LiveContainer',
      bundleId: 'com.kdt.livecontainer',
      kind: 'app',
      minimumIos: '15.0',
      channels: {
        stable: {
          github: {
            repo: 'LiveContainer/LiveContainer',
            asset: 'LiveContainer.ipa'
          },
          mirrors: [
            {
              github: {
                repo: 'LiveContainerMirror/LiveContainer',
                asset: 'LiveContainer.ipa'
              }
            }
          ]
        }
      }
    },
    {
      id: 'stikdebug',
      name: 'StikDebug',
      bundleId: 'com.stik.stikdebug',
      kind: 'app',
      minimumIos: '17.4',
      channels: {
        stable: {
          github: { repo: 'StikDebug/StikDebug', asset: 'StikDebug-*.ipa' }
        }
      }
    },
    {
      id: 'feather',
      name: 'Feather',
      bundleId: 'thewonderofyou.Feather',
      kind: 'app',
      channels: {
        stable: { github: { repo: 'khcrysalis/Feather', asset: 'Feather.ipa' } }
      }
    }
  ]
}
