import { serve } from "@hono/node-server";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { createContext } from "./context.js";
import { initDb } from "./db/index.js";
import { appRouter } from "./router.js";

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

await initDb();

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server listening on http://localhost:${info.port}`);
});
