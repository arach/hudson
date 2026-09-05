import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  cursorParam,
  defaultCapabilityRows,
  defineAction,
  defineAdmin,
  defineCapabilitiesAdmin,
  defineCreditsAdmin,
  definePrepareAdmin,
  defineResource,
  formatCell,
  handleAdminRequest,
  renderAdminDetailHtml,
  renderAdminHtml,
  statusTone,
} from "../index";

const Row = z.object({
  id: z.string(),
  n: z.number(),
});

describe("defineResource", () => {
  it("rejects incomplete defs", () => {
    expect(() =>
      defineResource({
        id: "",
        title: "X",
        row: Row,
        columns: [{ key: "id", label: "Id" }],
        list: async () => [],
      }),
    ).toThrow(/id/);
  });
});

describe("renderAdminHtml", () => {
  it("renders columns and validates rows against zod", () => {
    const resource = defineResource({
      id: "demo",
      title: "Demo",
      row: Row,
      columns: [
        { key: "id", label: "Id", format: "code" },
        { key: "n", label: "N", format: "int" },
      ],
      list: async () => [],
    });
    const admin = defineAdmin({
      title: "Test admin",
      resources: [resource],
    });
    const html = renderAdminHtml({
      admin,
      tables: [
        {
          resource,
          rows: [
            { id: "a", n: 1200 },
            { id: "bad", n: "nope" }, // dropped by safeParse
          ],
        },
      ],
      query: "key=secret",
      basePath: "/credits",
      stats: [{ id: "x", label: "Wallets", value: 3 }],
    });
    expect(html).toContain("Test admin");
    expect(html).toContain("1,200");
    expect(html).toContain("<code>a</code>");
    expect(html).not.toContain("nope");
    expect(html).toContain("Wallets");
  });

  it("drops malformed stats instead of trusting host data", () => {
    const resource = defineResource({
      id: "demo",
      title: "Demo",
      row: Row,
      columns: [{ key: "id", label: "Id" }],
      list: async () => [],
    });
    const admin = defineAdmin({ title: "Test admin", resources: [resource] });

    const html = renderAdminHtml({
      admin,
      tables: [{ resource, rows: [] }],
      query: "",
      basePath: "/admin",
      stats: [{ id: "bad", label: 7, value: 3 } as never],
    });

    expect(html).not.toContain('class="cards"');
  });
});

describe("handleAdminRequest", () => {
  it("serves GET and runs POST actions via host load/run", async () => {
    const grants: unknown[] = [];
    const admin = defineCreditsAdmin({
      accountId: "test",
      nav: [{ href: "/?key=k", label: "Prepare" }, { href: "/credits?key=k", label: "Credits", active: true }],
    });

    const handlers = {
      auth: () => true,
      basePath: "/credits",
      preserveQuery: () => "key=k",
      context: () => ({
        host: { accountId: "test" },
        load: async (name: string) => {
          if (name === "credits.stats") {
            return [
              { id: "day", label: "Today", value: "0", detail: "cap" },
            ];
          }
          if (name === "credits.wallets") {
            return [
              {
                userId: "u1",
                available: 100,
                held: 0,
                periodSpent: 50,
                lifetimeSpent: 50,
              },
            ];
          }
          if (name === "credits.entries") {
            return [
              {
                at: "2026-04-01T12:00:00Z",
                userId: "u1",
                op: "debit",
                kind: "llm",
                credits: 10,
                surface: "ask",
                gauge: "ok",
              },
            ];
          }
          return [];
        },
        run: async (name: string, input: unknown) => {
          if (name === "credits.grant") grants.push(input);
        },
      }),
    };

    const get = await handleAdminRequest(
      new Request("https://admin.example/credits?key=k"),
      admin,
      handlers,
    );
    expect(get).not.toBeNull();
    const getHtml = await get!.text();
    expect(getHtml).toContain("Inference credits");
    expect(getHtml).toContain("u1");
    expect(getHtml).toContain("Prepare");
    expect(get!.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(get!.headers.get("content-security-policy")).toContain(
      "form-action 'self'",
    );
    expect(get!.headers.get("x-content-type-options")).toBe("nosniff");
    expect(get!.headers.get("x-frame-options")).toBe("DENY");
    expect(get!.headers.get("referrer-policy")).toBe("no-referrer");

    const post = await handleAdminRequest(
      new Request("https://admin.example/credits/action/credits.grant?key=k", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "userId=u2&credits=500&reason=test",
      }),
      admin,
      handlers,
    );
    expect(post!.status).toBe(303);
    expect(grants).toEqual([
      { userId: "u2", credits: 500, reason: "test" },
    ]);
  });

  it("leaves form coercion to the action schema", async () => {
    const received: unknown[] = [];
    const admin = defineAdmin({
      title: "IDs",
      resources: [
        defineResource({
          id: "ids",
          title: "IDs",
          row: Row,
          columns: [{ key: "id", label: "Id" }],
          list: async () => [],
        }),
      ],
      actions: [
        defineAction({
          id: "ids.save",
          title: "Save",
          input: z.object({
            userId: z.string(),
            count: z.coerce.number().int(),
          }),
          fields: [
            { name: "userId", label: "User", kind: "text" },
            { name: "count", label: "Count", kind: "number" },
          ],
          run: async (input) => {
            received.push(input);
          },
        }),
      ],
    });

    const response = await handleAdminRequest(
      new Request("https://admin.example/admin/action/ids.save", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "userId=00123&count=7",
      }),
      admin,
      {
        auth: () => true,
        basePath: "/admin",
        context: () => ({
          host: {},
          load: async () => [],
          run: async () => {},
        }),
      },
    );

    expect(response?.status).toBe(303);
    expect(received).toEqual([{ userId: "00123", count: 7 }]);
  });

  it("returns null when path is outside basePath", async () => {
    const admin = defineAdmin({
      title: "X",
      resources: [
        defineResource({
          id: "r",
          title: "R",
          row: Row,
          columns: [{ key: "id", label: "Id" }],
          list: async () => [],
        }),
      ],
    });
    const res = await handleAdminRequest(
      new Request("https://admin.example/other"),
      admin,
      {
        auth: () => true,
        basePath: "/credits",
        context: () => ({
          host: {},
          load: async () => [],
          run: async () => {},
        }),
      },
    );
    expect(res).toBeNull();
  });

  it("puts security headers on HTML detail and not-found pages", async () => {
    const resource = defineResource({
      id: "events",
      title: "Events",
      row: Row,
      columns: [{ key: "id", label: "Id" }],
      list: async () => [],
      get: async (_ctx, id) => (id === "e1" ? { id: "e1", n: 1 } : null),
    });
    const admin = defineAdmin({ title: "Prep", resources: [resource] });
    const handlers = {
      auth: () => true,
      basePath: "/admin",
      context: () => ({
        host: {},
        load: async () => [],
        run: async () => {},
      }),
    };

    const detail = await handleAdminRequest(
      new Request("https://admin.example/admin/events/e1"),
      admin,
      handlers,
    );
    expect(detail!.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
    expect(detail!.headers.get("x-content-type-options")).toBe("nosniff");
    expect(detail!.headers.get("referrer-policy")).toBe("no-referrer");

    const missing = await handleAdminRequest(
      new Request("https://admin.example/admin/events/missing"),
      admin,
      handlers,
    );
    expect(missing!.status).toBe(404);
    expect(missing!.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(missing!.headers.get("x-frame-options")).toBe("DENY");
  });
});

describe("defineAction validation", () => {
  it("validates grant input", () => {
    const action = defineAction({
      id: "credits.grant",
      title: "Grant",
      input: z.object({
        userId: z.string().min(1),
        credits: z.coerce.number().int().positive(),
      }),
      fields: [
        { name: "userId", label: "User", kind: "text" },
        { name: "credits", label: "Credits", kind: "number" },
      ],
      run: async () => {},
    });
    expect(action.input.safeParse({ userId: "", credits: 1 }).success).toBe(
      false,
    );
    expect(
      action.input.safeParse({ userId: "a", credits: "100" }).success,
    ).toBe(true);
  });
});

const FmtRow = z.object({
  id: z.string(),
  kind: z.string(),
  state: z.string(),
  usd: z.number(),
  size: z.number(),
  payload: z.unknown().optional(),
});

describe("column formats", () => {
  it("renders badge, status, currency, and bytes", () => {
    const resource = defineResource({
      id: "fmt",
      title: "Formats",
      row: FmtRow,
      columns: [
        { key: "kind", label: "Kind", format: "badge" },
        { key: "state", label: "State", format: "status" },
        { key: "usd", label: "Cost", format: "currency" },
        { key: "size", label: "Size", format: "bytes" },
      ],
      list: async () => [],
    });
    const admin = defineAdmin({ title: "Fmt", resources: [resource] });
    const html = renderAdminHtml({
      admin,
      tables: [
        {
          resource,
          rows: [
            { id: "1", kind: "ask", state: "observe", usd: 1.5, size: 1536 },
            { id: "2", kind: "tts", state: "off", usd: 0.001, size: 1048576 },
            { id: "3", kind: "llm", state: "soft", usd: 0, size: 200 },
          ],
        },
      ],
      query: "",
      basePath: "/admin",
    });

    expect(html).toContain('class="badge">ASK</span>');
    expect(html).toContain('class="status ok">observe</span>');
    expect(html).toContain('class="status bad">off</span>');
    expect(html).toContain('class="status warn">soft</span>');
    expect(html).toContain("$1.50");
    expect(html).toContain("$0.00100");
    expect(html).toContain("$0");
    expect(html).toContain("1.5 KB");
    expect(html).toContain("1 MB");
    expect(html).toContain("200 B");
  });

  it("maps status tones for capability modes", () => {
    expect(statusTone("observe")).toBe("ok");
    expect(statusTone("soft")).toBe("warn");
    expect(statusTone("hard")).toBe("bad");
    expect(statusTone("off")).toBe("bad");
    expect(statusTone("mystery")).toBe("dim");
  });

  it("formatCell uses em dash for empty values", () => {
    expect(formatCell(null, { key: "x", label: "X", format: "badge" })).toContain(
      "—",
    );
    expect(formatCell("", { key: "x", label: "X", format: "status" })).toContain(
      "—",
    );
  });
});

describe("filter and search schemas", () => {
  it("rejects select filters without options", () => {
    expect(() =>
      defineResource({
        id: "demo",
        title: "Demo",
        row: Row,
        columns: [{ key: "id", label: "Id" }],
        filters: [{ param: "state", label: "State", kind: "select" }],
        list: async () => [],
      }),
    ).toThrow(/options/);
  });

  it("renders search and select filters and forwards query to list", async () => {
    const seen: unknown[] = [];
    const resource = defineResource({
      id: "events",
      title: "Events",
      row: Row,
      columns: [{ key: "id", label: "Id", format: "code" }],
      search: { placeholder: "id or user" },
      filters: [
        {
          param: "stage",
          label: "Stage",
          kind: "select",
          options: [
            { value: "prepare", label: "Prepare" },
            { value: "ask", label: "Ask" },
          ],
        },
      ],
      list: async (_ctx, query) => {
        seen.push(query);
        return [{ id: "e1", n: 1 }];
      },
    });
    const admin = defineAdmin({ title: "Prep", resources: [resource] });
    const res = await handleAdminRequest(
      new Request("https://admin.example/admin?q=alice&stage=ask&key=k"),
      admin,
      {
        auth: () => true,
        basePath: "/admin",
        preserveQuery: () => "key=k",
        context: () => ({
          host: {},
          load: async () => [],
          run: async () => {},
        }),
      },
    );
    const html = await res!.text();
    expect(html).toContain('name="q"');
    expect(html).toContain("alice");
    expect(html).toContain('name="stage"');
    expect(html).toContain('value="ask" selected');
    expect(html).toContain('type="hidden" name="key" value="k"');
    expect(seen).toEqual([
      { cursor: undefined, limit: 50, search: "alice", filters: { stage: "ask" } },
    ]);
  });
});

describe("cursor pagination", () => {
  it("passes cursor and limit into list and renders a next link", async () => {
    const seen: unknown[] = [];
    const resource = defineResource({
      id: "events",
      title: "Events",
      row: Row,
      columns: [{ key: "id", label: "Id" }],
      limit: 2,
      list: async (_ctx, query) => {
        seen.push(query);
        return { rows: [{ id: "a", n: 1 }, { id: "b", n: 2 }], nextCursor: "c2" };
      },
    });
    const admin = defineAdmin({ title: "Prep", resources: [resource] });
    const res = await handleAdminRequest(
      new Request("https://admin.example/admin?events.cursor=c1&events.limit=2"),
      admin,
      {
        auth: () => true,
        basePath: "/admin",
        context: () => ({
          host: {},
          load: async (_name, params) => params ?? {},
          run: async () => {},
        }),
      },
    );
    const html = await res!.text();
    expect(seen).toEqual([
      { cursor: "c1", limit: 2, search: undefined, filters: {} },
    ]);
    expect(html).toContain("Next");
    expect(html).toContain(`${cursorParam("events")}=c2`);
    expect(html).toContain("First");
  });

  it("does not invent a next cursor for plain arrays", async () => {
    const resource = defineResource({
      id: "events",
      title: "Events",
      row: Row,
      columns: [{ key: "id", label: "Id" }],
      limit: 1,
      list: async () => [
        { id: "a", n: 1 },
        { id: "b", n: 2 },
      ],
    });
    const admin = defineAdmin({ title: "Prep", resources: [resource] });
    const res = await handleAdminRequest(
      new Request("https://admin.example/admin"),
      admin,
      {
        auth: () => true,
        basePath: "/admin",
        context: () => ({
          host: {},
          load: async () => [],
          run: async () => {},
        }),
      },
    );
    const html = await res!.text();
    expect(html).toContain(">a<");
    expect(html).not.toContain(">b<");
    expect(html).not.toContain("class=\"pager\"");
  });
});

describe("detail routes", () => {
  const resource = defineResource({
    id: "events",
    title: "Events",
    row: FmtRow,
    columns: [
      { key: "id", label: "Id", format: "code" },
      { key: "kind", label: "Kind", format: "badge" },
      { key: "state", label: "State", format: "status" },
    ],
    idKey: "id",
    detail: { dumps: ["payload"] },
    list: async () => [
      { id: "e1", kind: "ask", state: "ok", usd: 0, size: 0 },
    ],
    get: async (_ctx, id) => {
      if (id !== "e1") return null;
      return {
        id: "e1",
        kind: "ask",
        state: "ok",
        usd: 0,
        size: 0,
        payload: { prompt: "hello", reply: { text: "world" } },
      };
    },
  });
  const admin = defineAdmin({ title: "Prep", resources: [resource] });
  const handlers = {
    auth: () => true,
    basePath: "/admin",
    preserveQuery: () => "key=k",
    context: () => ({
      host: {},
      load: async (name: string, params?: { id?: string }) => {
        if (name === "events.one" && params?.id === "e1") {
          return { id: "e1" };
        }
        return null;
      },
      run: async () => {},
    }),
  };

  it("lists a link to GET /:resourceId/:id", async () => {
    const res = await handleAdminRequest(
      new Request("https://admin.example/admin?key=k"),
      admin,
      handlers,
    );
    const html = await res!.text();
    expect(html).toContain("/admin/events/e1?key=k");
  });

  it("renders the detail page with dumps", async () => {
    const res = await handleAdminRequest(
      new Request("https://admin.example/admin/events/e1?key=k"),
      admin,
      handlers,
    );
    expect(res!.status).toBe(200);
    const html = await res!.text();
    expect(html).toContain("Events");
    expect(html).toContain('class="badge">ASK</span>');
    expect(html).toContain("hello");
    expect(html).toContain("world");
    expect(html).toContain("← Events");
  });

  it("returns HTML 404 when the record is missing", async () => {
    const res = await handleAdminRequest(
      new Request("https://admin.example/admin/events/missing"),
      admin,
      handlers,
    );
    expect(res!.status).toBe(404);
    const html = await res!.text();
    expect(html).toContain("No such record.");
  });

  it("returns JSON 404 for an unknown resource under the mount", async () => {
    const res = await handleAdminRequest(
      new Request("https://admin.example/admin/nope/x"),
      admin,
      handlers,
    );
    expect(res!.status).toBe(404);
    expect(await res!.json()).toEqual({ error: "Unknown resource: nope" });
  });

  it("renderAdminDetailHtml dumps JSON objects", () => {
    const html = renderAdminDetailHtml({
      admin,
      resource,
      row: {
        id: "e1",
        kind: "ask",
        state: "ok",
        usd: 0,
        size: 0,
        payload: { a: 1 },
      },
      query: "key=k",
      basePath: "/admin",
    });
    expect(html).toContain("&quot;a&quot;: 1");
  });
});

describe("select and toggle actions", () => {
  it("rejects toggle/select fields without options", () => {
    expect(() =>
      defineAction({
        id: "x.toggle",
        title: "Toggle",
        input: z.object({ mode: z.string() }),
        fields: [{ name: "mode", label: "Mode", kind: "toggle" }],
        run: async () => {},
      }),
    ).toThrow(/options/);
  });

  it("renders a page-level select and a per-row mode toggle", async () => {
    const modes = [
      { value: "off", label: "off" },
      { value: "observe", label: "observe" },
    ];
    const row = z.object({ id: z.string(), mode: z.string() });
    const resource = defineResource({
      id: "capabilities",
      title: "Levers",
      row,
      idKey: "id",
      columns: [
        { key: "id", label: "Id", format: "badge" },
        { key: "mode", label: "Mode", format: "status" },
      ],
      list: async () => [{ id: "ask", mode: "observe" }],
    });
    const admin = defineAdmin({
      title: "Levers",
      resources: [resource],
      actions: [
        defineAction({
          id: "capabilities.setPolicy",
          title: "Set policy",
          input: z.object({
            id: z.string(),
            mode: z.string(),
          }),
          fields: [
            {
              name: "id",
              label: "Capability",
              kind: "select",
              options: [{ value: "ask", label: "ask" }],
            },
            {
              name: "mode",
              label: "Mode",
              kind: "toggle",
              options: modes,
            },
          ],
          run: async () => {},
        }),
        defineAction({
          id: "capabilities.setMode",
          title: "Mode",
          beside: "capabilities",
          perRow: true,
          input: z.object({
            id: z.string(),
            mode: z.string(),
          }),
          fields: [
            { name: "id", label: "Id", kind: "hidden" },
            {
              name: "mode",
              label: "Mode",
              kind: "toggle",
              options: modes,
            },
          ],
          run: async () => {},
        }),
      ],
    });

    const res = await handleAdminRequest(
      new Request("https://admin.example/levers"),
      admin,
      {
        auth: () => true,
        basePath: "/levers",
        context: () => ({
          host: {},
          load: async () => [],
          run: async () => {},
        }),
      },
    );
    const html = await res!.text();
    expect(html).toContain('name="id"');
    expect(html).toContain("<select");
    expect(html).toContain('type="radio"');
    expect(html).toContain("/levers/action/capabilities.setMode");
    expect(html).toContain('value="ask"');
    expect(html).toContain('value="observe" checked');
    expect(html).toContain("class=\"row-action\"");
  });
});

describe("defineCapabilitiesAdmin", () => {
  it("declares the catalog and posts setMode", async () => {
    const posted: unknown[] = [];
    const admin = defineCapabilitiesAdmin();
    const rows = defaultCapabilityRows();
    rows[0] = { ...rows[0], mode: "soft", credits7d: 12 };

    const handlers = {
      auth: () => true,
      basePath: "/levers",
      context: () => ({
        host: {},
        load: async (name: string) => {
          if (name === "capabilities.overview") return rows;
          if (name === "capabilities.stats") return [];
          return [];
        },
        run: async (name: string, input: unknown) => {
          posted.push({ name, input });
        },
      }),
    };

    const get = await handleAdminRequest(
      new Request("https://admin.example/levers"),
      admin,
      handlers,
    );
    const html = await get!.text();
    expect(html).toContain("ASK");
    expect(html).toContain('class="status warn">soft</span>');
    expect(html).toContain("Set policy");

    const post = await handleAdminRequest(
      new Request("https://admin.example/levers/action/capabilities.setMode", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "capability=ask&mode=off",
      }),
      admin,
      handlers,
    );
    expect(post!.status).toBe(303);
    expect(posted).toEqual([
      { name: "capabilities.setMode", input: { capability: "ask", mode: "off" } },
    ]);
  });
});

describe("definePrepareAdmin", () => {
  it("lists, filters, and serves GET /events/:id", async () => {
    const seen: unknown[] = [];
    const event = {
      id: "e1",
      at: 1_700_000_000_000,
      status: "ok",
      stage: "prepare",
      model: "deepseek/deepseek-v4-flash",
      blockCount: 3,
      tokens: "10/4",
      costUsd: 0.001,
      durationMs: 800,
      detail: null,
      sentText: "page text",
      blocks: [{ role: "heading", text: "Hi" }],
      rawRequest: "{}",
      rawResponse: "{}",
    };
    const admin = definePrepareAdmin();
    const handlers = {
      auth: () => true,
      basePath: "/prepare",
      context: () => ({
        host: {},
        load: async (name: string, params?: { id?: string; filters?: Record<string, string> }) => {
          seen.push({ name, params });
          if (name === "prepare.stats") {
            return [{ id: "n", label: "attempts", value: 1 }];
          }
          if (name === "prepare.event") {
            return params?.id === "e1" ? event : null;
          }
          if (name === "prepare.events") {
            return { rows: [event], nextCursor: "next" };
          }
          return [];
        },
        run: async () => {},
      }),
    };

    const list = await handleAdminRequest(
      new Request("https://admin.example/prepare?status=ok"),
      admin,
      handlers,
    );
    const listHtml = await list!.text();
    expect(listHtml).toContain("/prepare/events/e1");
    expect(listHtml).toContain("attempts");
    expect(listHtml).toContain("$0.00100");
    expect(listHtml).toContain('class="status ok">ok</span>');
    expect(seen.some((s) => (s as { name: string }).name === "prepare.events")).toBe(
      true,
    );

    const detail = await handleAdminRequest(
      new Request("https://admin.example/prepare/events/e1"),
      admin,
      handlers,
    );
    expect(detail!.status).toBe(200);
    const detailHtml = await detail!.text();
    expect(detailHtml).toContain("page text");
    expect(detailHtml).toContain("heading");
  });
});


