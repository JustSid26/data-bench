import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Tooltip from "@radix-ui/react-tooltip";
import { App } from "./App";
import { ToastProvider } from "./components/ui/Toaster";
import { MotionProvider } from "./lib/motion";
import { CleaningProvider } from "./state/cleaning";
import { SessionProvider } from "./state/session";
import { ThemeProvider } from "./state/theme";
import { UiProvider } from "./state/ui";
import "./index.css";

const queries = new QueryClient({
  defaultOptions: {
    queries: {
      // the backend caches schema and profile per dataset, so anything we have
      // already fetched is still correct -- no reason to refetch on focus
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queries}>
      <ThemeProvider>
        <MotionProvider>
          <Tooltip.Provider delayDuration={300}>
            <ToastProvider>
              <SessionProvider>
                <CleaningProvider>
                  <UiProvider>
                    <App />
                  </UiProvider>
                </CleaningProvider>
              </SessionProvider>
            </ToastProvider>
          </Tooltip.Provider>
        </MotionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
