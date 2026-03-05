import type { ElectrobunConfig } from "electrobun/bun";

const config: ElectrobunConfig = {
  app: {
    name: "Hudson",
    identifier: "dev.hudson.bunsen",
    version: "0.0.7",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    copy: {
      "dist/mainview": "views/mainview",
    },
    mac: {
      codesign: true,
      notarize: false,
    },
  },
  release: {
    generatePatch: false,
  },
  scripts: {
    postPackage: "scripts/post-package.sh",
  },
};

export default config;
