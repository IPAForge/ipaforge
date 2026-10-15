// Electron hardening that applies to every web contents: the window shows the bundled UI and nothing else.
import type { Logger } from "@loadstar/kernel";
import type { Session, WebContents } from "electron";

/** No pop-ups and no navigation away from the UI; links to the outside world come later, through the main process. */
export const lockDownWebContents = (contents: WebContents, logger: Logger): void => {
  contents.setWindowOpenHandler(({ url }) => {
    logger.warn("blocked a new window", { url });
    return { action: "deny" };
  });
  contents.on("will-navigate", (event) => {
    logger.warn("blocked a navigation", { url: event.url });
    event.preventDefault();
  });
  contents.on("will-attach-webview", (event) => {
    logger.warn("blocked a webview");
    event.preventDefault();
  });
};

/** The UI needs no camera, microphone, notifications or other permission; every request is refused. */
export const denyAllPermissions = (session: Session, logger: Logger): void => {
  session.setPermissionRequestHandler((_contents, permission, callback) => {
    logger.warn("denied a permission request", { permission });
    callback(false);
  });
  session.setPermissionCheckHandler(() => false);
};
