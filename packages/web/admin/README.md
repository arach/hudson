# `@hudsonkit/admin`

Schema-driven operator admin. Domains declare **resources** (Zod row + columns + loader) and **actions**; hosts wire auth and data. The shell does not know about credits, prepare, or any product store.

See [docs/admin-resources.md](../../../docs/admin-resources.md).

```ts
import {
  defineCreditsAdmin,
  handleAdminRequest,
} from "@hudsonkit/admin";

const admin = defineCreditsAdmin({ accountId: "linea-prod" });

export default {
  async fetch(request: Request) {
    const res = await handleAdminRequest(request, admin, {
      basePath: "/credits",
      auth: (req) => checkToken(req),
      context: () => ({
        host: {},
        load: loadFromD1,
        run: runGrant,
      }),
    });
    return res ?? new Response("Not found", { status: 404 });
  },
};
```
