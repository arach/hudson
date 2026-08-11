import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  defineAction,
  defineAdmin,
  defineCreditsAdmin,
  defineResource,
  handleAdminRequest,
  renderAdminHtml,
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
        load: async <T,>(name: string): Promise<T> => {
          if (name === "credits.stats") {
            return [
              { id: "day", label: "Today", value: "0", detail: "cap" },
            ] as T;
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
            ] as T;
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
            ] as T;
          }
          return [] as T;
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
          load: async <T,>() => [] as T,
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
          load: async <T,>() => [] as T,
          run: async () => {},
        }),
      },
    );
    expect(res).toBeNull();
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
