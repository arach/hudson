// Prepend shebang to dist/index.js and make executable
import { readFileSync, writeFileSync, chmodSync } from 'fs';

const f = 'dist/index.js';
let content = readFileSync(f, 'utf8');

// Remove any existing shebang (from source)
content = content.replace(/^#!.*\n/, '');

writeFileSync(f, '#!/usr/bin/env node\n' + content);
chmodSync(f, 0o755);
