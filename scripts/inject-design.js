#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

const AVAILABLE_PRESETS = ['linear', 'stripe', 'apple', 'raycast'];

export function injectDesignSystem(presetName, targetDir = process.cwd()) {
  const normalized = (presetName || 'linear').toLowerCase().trim();
  
  if (!AVAILABLE_PRESETS.includes(normalized)) {
    console.error(`\n${c.red}Unknown design preset: "${presetName}". Available: ${AVAILABLE_PRESETS.join(', ')}${c.reset}\n`);
    process.exit(1);
  }

  const presetFile = path.join(ROOT_DIR, 'design-systems', `${normalized}.md`);
  if (!fs.existsSync(presetFile)) {
    console.error(`\n${c.red}Preset file missing: ${presetFile}${c.reset}\n`);
    process.exit(1);
  }

  const content = fs.readFileSync(presetFile, 'utf-8');
  const targetPath = path.join(targetDir, 'DESIGN.md');

  fs.writeFileSync(targetPath, content.trim() + '\n');
  console.log(`\n${c.green}${c.bold}✓ Successfully injected ${c.cyan}${normalized.toUpperCase()}${c.green} design system into: ${c.cyan}${targetPath}${c.reset}`);
  console.log(`${c.gray}Coding agents (Cursor, Claude Code, Antigravity) will now adhere to these design tokens and micro-interactions.${c.reset}\n`);
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith('inject-design.js')) {
  const preset = process.argv[2] || 'linear';
  injectDesignSystem(preset);
}
