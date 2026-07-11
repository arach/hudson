import assert from "node:assert/strict";
import test from "node:test";

import { classifyFiles } from "./classify-changes.mjs";

const none = {
  workflows: false,
  web: false,
  native: false,
  cloud: false,
  any: true,
};

const cases = [
  {
    name: "web",
    files: ["apps/web/app/page.tsx"],
    expected: { ...none, web: true },
  },
  {
    name: "native",
    files: ["packages/native/apple/HudsonKit/Package.swift"],
    expected: { ...none, native: true },
  },
  {
    name: "cloud",
    files: ["packages/cloud/hudson-relay-worker/src/index.ts"],
    expected: { ...none, cloud: true },
  },
  {
    name: "workflow",
    files: [".github/workflows/ci.yml"],
    expected: { ...none, workflows: true },
  },
  {
    name: "docs",
    files: ["docs/building-apps.md"],
    expected: { ...none, web: true },
  },
  {
    name: "mixed",
    files: [
      ".github/workflows/release.yml",
      "apps/web/app/page.tsx",
      "packages/native/apple/HudsonKit/Package.swift",
      "packages/cloud/hudson-relay-worker/src/index.ts",
    ],
    expected: {
      workflows: true,
      web: true,
      native: true,
      cloud: true,
      any: true,
    },
  },
  {
    name: "apps/hudson/native retains web classification and adds native",
    files: ["apps/hudson/native/Sources/HudsonApp/HudsonApp.swift"],
    expected: { ...none, web: true, native: true },
  },
];

for (const { name, files, expected } of cases) {
  test(`classifies ${name} changes`, () => {
    assert.deepEqual(classifyFiles(files), expected);
  });
}

test("workflow_call forces every surface", () => {
  assert.deepEqual(classifyFiles(["__workflow_call__"], { forceAll: true }), {
    workflows: true,
    web: true,
    native: true,
    cloud: true,
    any: true,
  });
});
