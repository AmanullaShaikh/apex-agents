#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const testsDir = path.join(ROOT_DIR, 'tests');

const testFiles = fs.readdirSync(testsDir)
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => path.join(testsDir, f));

const child = spawn(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
  cwd: ROOT_DIR
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
