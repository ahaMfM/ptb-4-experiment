import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { TRPCProvider } from "./trpc";
import type { AppRouter } from "server/router";
import "./styles.css";

function Root() {
  const [queryClient] = useState(() => {
    const client: QueryClient = new QueryClient({
      queryCache: new QueryCache({
        onError: (error) => {
          // A session can expire while the app is open. When the server
          // says "not signed in", re-check who is signed in so the
          // sign-in screen comes back.
          if (
            error instanceof TRPCClientError &&
            error.data?.code === "UNAUTHORIZED"
          ) {
            void client.invalidateQueries({ queryKey: [["auth", "me"]] });
          }
        },
      }),
    });
    return client;
  });
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: "/trpc" })],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <App />
      </TRPCProvider>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
