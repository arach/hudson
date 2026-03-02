import type { ElectrobunConfig } from "electrobun/bun";

const config: ElectrobunConfig = {
  app: {
    name: "Hudson",
    identifier: "dev.hudson.bunsen",
    version: "0.0.1",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    mac: {
      codesign: true,
      notarize: true,
    },
  },
  scripts: {
    postPackage: "scripts/post-package.sh",
  },
};

export default config;
