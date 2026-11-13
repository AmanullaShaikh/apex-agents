#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function exportAllHarnesses(targetDir = process.cwd()) {
  console.log(`\x1b[36m\x1b[1m[Apex-Agents Universal Exporter] Generating configs for all AI harnesses in ${targetDir}...\x1b[0m\n`);

  const instinctsDir = path.join(ROOT_DIR, 'instincts');
  const instincts = fs.readdirSync(instinctsDir).filter(f => f.endsWith('.md')).map(f => {
    return fs.readFileSync(path.join(instinctsDir, f), 'utf-8');
  }).join('\n\n---\n\n');

  const unifiedDirectives = `# Apex Agents Autonomous Engineering Directives
This repository operates under Apex Agents Zero-Slop Operational Instincts.

${instincts}
`;

  // 1. Claude Code: CLAUDE.md
  fs.writeFileSync(path.join(targetDir, 'CLAUDE.md'), unifiedDirectives);
  console.log(`  \x1b[32m✓\x1b[0m Generated \x1b[36mCLAUDE.md\x1b[0m (Claude Code)`);

  // 2. Cursor: .cursorrules & .cursor/rules/*.mdc
  fs.writeFileSync(path.join(targetDir, '.cursorrules'), unifiedDirectives);
  console.log(`  \x1b[32m✓\x1b[0m Generated \x1b[36m.cursorrules\x1b[0m (Cursor Legacy)`);

  // 3. Windsurf: .windsurfrules
  fs.writeFileSync(path.join(targetDir, '.windsurfrules'), unifiedDirectives);
  console.log(`  \x1b[32m✓\x1b[0m Generated \x1b[36m.windsurfrules\x1b[0m (Windsurf Cascade)`);

  // 4. GitHub Copilot: .github/copilot-instructions.md
  const githubDir = path.join(targetDir, '.github');
  fs.mkdirSync(githubDir, { recursive: true });
  fs.writeFileSync(path.join(githubDir, 'copilot-instructions.md'), unifiedDirectives);
  console.log(`  \x1b[32m✓\x1b[0m Generated \x1b[36m.github/copilot-instructions.md\x1b[0m (GitHub Copilot)`);

  // 5. Aider: .aider.prompt.md
  fs.writeFileSync(path.join(targetDir, '.aider.prompt.md'), unifiedDirectives);
  console.log(`  \x1b[32m✓\x1b[0m Generated \x1b[36m.aider.prompt.md\x1b[0m (Aider CLI)`);

  console.log(`\n\x1b[32m\x1b[1m🎉 Successfully deployed to all 5 AI developer ecosystems!\x1b[0m\n`);
}

exportAllHarnesses(process.argv[2] || process.cwd());
