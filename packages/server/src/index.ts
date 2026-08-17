import { serve } from "@hono/node-server";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { initDb } from "./db/client.js";
import { ensureStarterAccount } from "./modules/team.js";
import { appRouter } from "./router.js";
import { createContext } from "./sessions.js";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext,
  }),
);

const port = Number(process.env.PORT ?? 3000);

// Schema first, then make sure somebody can sign in.
await initDb();
await ensureStarterAccount();

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server listening on http://localhost:${info.port}`);
});
