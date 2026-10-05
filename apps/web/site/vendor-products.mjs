// Builds product sites and mounts their static bundles under site/out/<name>/,
// so the Cloudflare worker serves them at hudsonkit.com/<name> — the same
// single-domain shape lattices.dev uses for its subproducts.
//
//   bun site/vendor-products.mjs            # build every product
//   bun site/vendor-products.mjs arc        # build one product
//   SKIP_VENDOR_PRODUCTS=1 bun run build:site
//
// Each product pins a `ref` (overridable via <NAME>_REF) so deploys are
// reproducible; bump the ref to roll the product forward.

import { execFileSync } from 'node:child_process';
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeSearchFiles } from './finalize-search.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'site', 'out');
const vendorDir = join(root, 'site', '.vendor');

const PRODUCTS = [
  {
    name: 'arc',
    repo: 'https://github.com/arach/arc.git',
    // Pin to a sha/tag for reproducible deploys; ARC_REF overrides.
    ref: 'main',
    buildEnv: {
      ARC_BASE: '/arc/',
      SITE_URL: 'https://hudsonkit.com/arc',
    },
    buildCommand: ['bun', 'run', 'build:site'],
    distDir: 'dist',
  },
  // { name: 'atelier', ... } — mount the same way when it lands.
];

function run(cmd, args, cwd, extraEnv = {}) {
  console.log(`  $ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...extraEnv } });
}

async function vendorProduct(product) {
  const ref = process.env[`${product.name.toUpperCase()}_REF`] || product.ref;
  const dir = join(vendorDir, product.name);
  const url = `${product.repo}#${ref}`;

  console.log(`\n→ Vendoring ${product.name} (${url})`);

  if (existsSync(dir)) {
    // Keep the pinned checkout fresh without re-cloning.
    run('git', ['fetch', '--depth', '1', 'origin', ref], dir);
    run('git', ['checkout', '--detach', 'FETCH_HEAD'], dir);
  } else {
    run('git', ['clone', '--depth', '1', '--branch', ref, product.repo, dir], vendorDir);
  }

  run('bun', ['install', '--frozen-lockfile'], dir);
  run(product.buildCommand[0], product.buildCommand.slice(1), dir, product.buildEnv);

  const dist = join(dir, product.distDir);
  if (!existsSync(dist)) {
    throw new Error(`${product.name}: expected build output at ${dist}`);
  }

  const target = join(outDir, product.name);
  await rm(target, { recursive: true, force: true });
  await mkdir(dirname(target), { recursive: true });
  await cp(dist, target, { recursive: true });
  console.log(`✓ ${product.name} → site/out/${product.name}`);
}

if (process.env.SKIP_VENDOR_PRODUCTS) {
  console.log('SKIP_VENDOR_PRODUCTS set — leaving site/out without vendored products');
  process.exit(0);
}

const selected = process.argv.slice(2);
const products = selected.length
  ? PRODUCTS.filter(p => selected.includes(p.name))
  : PRODUCTS;

if (selected.length && products.length === 0) {
  console.error(`Unknown product(s): ${selected.join(', ')}. Known: ${PRODUCTS.map(p => p.name).join(', ')}`);
  process.exit(1);
}

await mkdir(vendorDir, { recursive: true });
for (const product of products) {
  await vendorProduct(product);
}

await writeSearchFiles(outDir);
