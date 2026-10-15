// Built-in fallback for when the remote manifest cannot be fetched. Must equal catalog/sources.json (a test checks).
import type { Manifest } from "@catalog/domain/manifest.ts";

export const DEFAULT_MANIFEST: Manifest = {
  version: 1,
  apps: [
    {
      id: "sidestore",
      name: "SideStore",
      bundleId: "com.SideStore.SideStore",
      kind: "sidestore",
      minimumIos: "15.0",
      channels: {
        stable: {
          github: {
            repo: "SideStore/SideStore",
            asset: "SideStore.ipa",
          },
        },
        nightly: {
          github: {
            repo: "SideStore/SideStore",
            tag: "nightly",
            asset: "SideStore.ipa",
          },
        },
      },
    },
    {
      id: "livecontainer-sidestore",
      name: "LiveContainer + SideStore",
      bundleId: "com.kdt.livecontainer",
      kind: "livecontainer-sidestore",
      minimumIos: "15.0",
      channels: {
        stable: {
          github: {
            repo: "LiveContainer/LiveContainer",
            asset: "LiveContainer+SideStore.ipa",
          },
          mirrors: [
            {
              github: {
                repo: "LiveContainerMirror/LiveContainer",
                asset: "LiveContainer+SideStore.ipa",
              },
            },
          ],
        },
        nightly: {
          github: {
            repo: "LiveContainer/LiveContainer",
            tag: "nightly",
            asset: "LiveContainer+SideStore.ipa",
          },
          mirrors: [
            {
              github: {
                repo: "LiveContainerMirror/LiveContainer",
                tag: "nightly",
                asset: "LiveContainer+SideStore.ipa",
              },
            },
          ],
        },
      },
    },
  ],
};
