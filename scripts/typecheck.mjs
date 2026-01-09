#!/usr/bin/env node
// This script runs typecheck

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const tsc = spawn('node', [
  join(projectRoot, 'node_modules/typescript/bin/tsc'),
  '--noEmit'
], {
  cwd: projectRoot,
  stdio: 'inherit'
});

tsc.on('close', (code) => {
  process.exit(code);
});
