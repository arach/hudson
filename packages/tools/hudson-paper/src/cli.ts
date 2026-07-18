#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startServer } from "./mcp-http.ts";
import { DEFAULT_HOST, DEFAULT_PORT } from "./model.ts";
import * as store from "./store.ts";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
/** Public face (Hudson frame + canvas + proxied MCP/API). */
const PUBLIC_PORT = DEFAULT_PORT;
/** Internal API/MCP only — vite proxies to this. */
const API_PORT = Number(process.env.HUDSON_PAPER_API_PORT ?? PUBLIC_PORT + 2);

const USAGE = `hpaper — Hudson Paper (HudsonKit canvas + agent MCP)

USAGE
  hpaper serve [--port N] [--host HOST] [--api-only]
  hpaper doctor
  hpaper list
  hpaper create <name>
  hpaper path

  serve          API on internal port + Vite host on public port (default ${PUBLIC_PORT})
                 Open http://127.0.0.1:${PUBLIC_PORT}/ for Hudson frame + canvas
  --api-only     MCP/API only (no canvas host)

ENV
  HUDSON_PAPER_ROOT      Library (default: ~/.hudson-paper/files)
  HUDSON_PAPER_PORT      Public host port (default ${PUBLIC_PORT})
  HUDSON_PAPER_API_PORT  Internal API port (default ${API_PORT})
  HUDSON_PAPER_HOST      Default ${DEFAULT_HOST}
`;

async function doctor(): Promise<number> {
  const port = Number(process.env.HUDSON_PAPER_PORT ?? DEFAULT_PORT);
  const host = process.env.HUDSON_PAPER_HOST ?? DEFAULT_HOST;
  const url = `http://${host}:${port}/mcp`;
  try {
    const init = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "hpaper-doctor", version: "0.1.0" },
        },
      }),
    });
    const sid = init.headers.get("mcp-session-id") ?? init.headers.get("Mcp-Session-Id");
    const text = await init.text();
    if (!init.ok) {
      console.error(`doctor: initialize HTTP ${init.status}`);
      console.error(text.slice(0, 400));
      return 1;
    }
    const list = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(sid ? { "Mcp-Session-Id": sid } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    const listText = await list.text();
    const match = listText.match(/data:\s*(\{.*\})/);
    let toolCount = 0;
    if (match) {
      const payload = JSON.parse(match[1]!);
      toolCount = payload?.result?.tools?.length ?? 0;
    }
    const ui = await fetch(`http://${host}:${port}/`, {
      headers: { Accept: "text/html" },
    });
    console.log("Hudson Paper doctor");
    console.log(`  ui:     http://${host}:${port}/  (${ui.status})`);
    console.log(`  mcp:    ${url}`);
    console.log(`  health: ok`);
    console.log(`  tools:  ${toolCount}`);
    console.log(`  root:   ${store.libraryRoot()}`);
    return 0;
  } catch (e) {
    console.error("doctor: server not reachable — run `hpaper serve` first");
    console.error(e instanceof Error ? e.message : e);
    return 1;
  }
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(USAGE);
    process.exit(0);
  }

  if (cmd === "serve") {
    let publicPort = Number(process.env.HUDSON_PAPER_PORT ?? DEFAULT_PORT);
    let apiPort = Number(process.env.HUDSON_PAPER_API_PORT ?? publicPort + 2);
    let host = process.env.HUDSON_PAPER_HOST ?? DEFAULT_HOST;
    let apiOnly = false;
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === "--port") publicPort = Number(rest[++i]);
      if (rest[i] === "--host") host = String(rest[++i]);
      if (rest[i] === "--api-only") apiOnly = true;
      if (rest[i] === "--api-port") apiPort = Number(rest[++i]);
    }

    await store.ensureLibrary();

    if (apiOnly) {
      const s = startServer({ host, port: publicPort });
      console.log(`Hudson Paper API/MCP (no host) on ${s.url}`);
      console.log(`Library: ${store.libraryRoot()}`);
      await new Promise(() => {});
      return;
    }

    // API/MCP on internal port; Vite host on public port proxies /api /mcp
    process.env.HUDSON_PAPER_PUBLIC_PORT = String(publicPort);
    const api = startServer({ host, port: apiPort });
    console.log(`Hudson Paper API/MCP  http://${host}:${apiPort}/mcp  (internal)`);

    const child = spawn(
      "bunx",
      [
        "vite",
        "--config",
        join(PACKAGE_ROOT, "host/vite.config.ts"),
        "--port",
        String(publicPort),
        "--host",
        host,
      ],
      {
        cwd: PACKAGE_ROOT,
        env: {
          ...process.env,
          HUDSON_PAPER_PORT: String(publicPort),
          HUDSON_PAPER_API_PORT: String(apiPort),
          HUDSON_PAPER_HOST: host,
        },
        stdio: "inherit",
      },
    );

    console.log(`Hudson Paper canvas   http://${host}:${publicPort}/`);
    console.log(`  Frame + HUD chrome · journeys left · MCP via /mcp`);
    console.log(`Library: ${store.libraryRoot()}`);
    console.log(`Wire Grok: [mcp_servers.hudson-paper] url = "http://${host}:${publicPort}/mcp"`);

    const shutdown = () => {
      child.kill("SIGTERM");
      api.stop();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    child.on("exit", (code) => {
      api.stop();
      process.exit(code ?? 1);
    });

    await new Promise(() => {});
    return;
  }

  if (cmd === "doctor") {
    process.exit(await doctor());
  }

  if (cmd === "list") {
    const files = await store.listFiles();
    if (!files.length) {
      console.log("(empty) " + store.libraryRoot());
      process.exit(0);
    }
    for (const f of files) {
      console.log(`${f.id}\t${f.pageCount} pages\t${f.name}\t${f.updatedAt}`);
    }
    process.exit(0);
  }

  if (cmd === "create") {
    const name = rest.join(" ").trim() || "Untitled";
    const file = await store.createFile(name);
    console.log(
      JSON.stringify(
        { fileId: file.id, name: file.name, path: store.resolveFilePath(file.id) },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  if (cmd === "path") {
    console.log(store.libraryRoot());
    process.exit(0);
  }

  console.error(`Unknown command: ${cmd}`);
  console.log(USAGE);
  process.exit(1);
}

await main();
