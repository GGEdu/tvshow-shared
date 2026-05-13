import { createContext, useContext } from "react";

/**
 * Dependency-injection context for HTTP service clients.
 *
 * The consumer (AgenticTVShow / TelegramTVShow) creates its own service
 * modules with the same export names and passes them to the provider:
 *
 *   import { ServicesProvider } from "@ggedu/tvshow-ui";
 *   import { api } from "./services/api.js";
 *   import { authService } from "./services/auth.js";
 *   import { listsService } from "./services/lists.js";
 *   import { seriesService } from "./services/series.js";
 *   import { userService } from "./services/user.js";
 *
 *   const services = { api, authService, listsService, seriesService, userService };
 *
 *   <ServicesProvider services={services}>
 *     <AuthProvider>
 *       <App />
 *     </AuthProvider>
 *   </ServicesProvider>
 *
 * Shared hooks then read the service they need via useServices().
 */
export const ServicesContext = createContext(null);

export function ServicesProvider({ services, children }) {
  return (
    <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>
  );
}

export function useServices() {
  const ctx = useContext(ServicesContext);
  if (ctx === null) {
    throw new Error(
      "useServices must be used within <ServicesProvider services={...}>",
    );
  }
  return ctx;
}
