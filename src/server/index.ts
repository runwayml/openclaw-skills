import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import { createCallRouter } from "./routes.js";
import { createTunnel } from "./tunnel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "7891", 10);
const RUNWAYML_API_SECRET = process.env.RUNWAYML_API_SECRET;

if (!RUNWAYML_API_SECRET) {
  console.error(
    "\n  Missing RUNWAYML_API_SECRET environment variable.\n" +
      "  Get one at https://dev.runwayml.com/settings/api-keys\n" +
      "  Then: export RUNWAYML_API_SECRET=your_key\n"
  );
  process.exit(1);
}

const app = express();
app.use(express.json());

app.use("/api", createCallRouter(RUNWAYML_API_SECRET));

const isDev = process.env.NODE_ENV !== "production";

async function setupClient() {
  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: path.resolve(__dirname, "../client"),
      server: { middlewareMode: true, allowedHosts: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const clientDist = path.resolve(__dirname, "../../dist/client");
    app.use(express.static(clientDist));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }
}

await setupClient();

app.listen(PORT, async () => {
  const localUrl = `http://localhost:${PORT}`;
  console.log(`\n  🎥 OpenClaw Video Call`);
  console.log(`  Local:  ${localUrl}`);

  try {
    const tunnelUrl = await createTunnel(PORT);
    console.log(`  Tunnel: ${tunnelUrl}  (shareable — works from phone)`);

    app.locals.tunnelUrl = tunnelUrl;
  } catch {
    console.log(`  Tunnel: unavailable (localhost only)`);
  }

  app.locals.localUrl = localUrl;
  console.log(`\n  Waiting for calls from your OpenClaw agent...\n`);
});
