import { type UiServices, UiServicesContext } from "@ui/services/ui-services.ts";
import { useContext } from "react";

/** The host's services, provided by `App`. */
export const useUiServices = (): UiServices => {
  const services = useContext(UiServicesContext);
  if (!services) throw new Error("useUiServices must be used inside <App>");
  return services;
};
