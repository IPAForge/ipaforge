// TEMPORARY: the shell's English strings until the i18next setup lands (6b), which replaces this
// module with `locales/en/*.json` and `useTranslation()`. Keys already follow the planned namespaces.
const enShell = {
  "app.name": "Loadstar",
  "shell.skipToContent": "Skip to content",
  "shell.navigation": "Sections",
  "topBar.device": "Device",
  "topBar.noDevice": "None",
  "topBar.deviceMenu": "Devices",
  "topBar.noDevicesYet": "No devices yet",
  "topBar.account": "Apple ID",
  "topBar.notSignedIn": "Not signed in",
  "topBar.accountMenu": "Apple IDs",
  "topBar.addAppleIdSoon": "Add Apple ID… (coming soon)",
  "nav.group.manage": "Manage",
  "nav.install": "Install",
  "nav.preload": "Preload",
  "nav.devices": "Devices",
  "nav.accounts": "Accounts",
  "nav.certificates": "Certificates",
  "nav.logs": "Logs",
  "nav.settings": "Settings",
  "install.title": "Install SideStore",
  "install.description": "Signed with your Apple ID, then installed over USB.",
  "placeholder.body": "This section is under construction.",
  "settings.appearance": "Appearance",
  "settings.mode": "Colour mode",
  "settings.palette": "Palette",
  "theme.mode.system": "System",
  "theme.mode.light": "Light",
  "theme.mode.dark": "Dark",
  "theme.palette.graphite": "Graphite",
  "theme.palette.ocean": "Ocean",
  "theme.palette.aurora": "Aurora",
  "theme.palette.sunset": "Sunset",
  "theme.palette.forest": "Forest",
  "theme.palette.rose": "Rose",
} as const;

export type ShellKey = keyof typeof enShell;

/** Looks up a shell string; the signature matches i18next's `t` so call sites survive the switch. */
export const t = (key: ShellKey): string => enShell[key];
