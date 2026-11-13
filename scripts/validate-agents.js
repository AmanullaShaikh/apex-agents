#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const REQUIRED_SECTIONS = [
  'Identity & Role',
  'Strict Negative Constraints',
  'Execution Workflow',
  'Verification Gate'
];

const SLOP_PATTERNS = [
  /\/\/\s*TODO/i,
  /\/\*\s*TODO/i,
  /\bimplement later\b/i,
  /\bplace code here\b/i
];

function validateAgents() {
  console.log(`\x1b[36m\x1b[1m[Apex-Agents Validator] Running rigorous schema and zero-slop checks...\x1b[0m\n`);

  const agentsDir = path.join(ROOT_DIR, 'agents');
  const divisions = fs.readdirSync(agentsDir).filter((d) => fs.statSync(path.join(agentsDir, d)).isDirectory());

  let totalAgents = 0;
  let failures = [];

  for (const div of divisions) {
    const divPath = path.join(agentsDir, div);
    const files = fs.readdirSync(divPath).filter((f) => f.endsWith('.md'));

    for (const file of files) {
      totalAgents++;
      const fullPath = path.join(divPath, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const agentId = file.replace('.md', '');

      // 1. Validate YAML Frontmatter
      const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!frontmatterMatch) {
        failures.push({ file: `${div}/${file}`, error: 'Missing YAML frontmatter (--- ... ---)' });
        continue;
      }

      const fmLines = frontmatterMatch[1].split('\n');
      const fm = {};
      for (const line of fmLines) {
        const parts = line.split(':');
        if (parts.length >= 2) {
          fm[parts[0].trim()] = parts.slice(1).join(':').trim();
        }
      }

      if (!fm.name || !fm.division || !fm.role || !fm.triggers) {
        failures.push({ file: `${div}/${file}`, error: 'Frontmatter missing mandatory keys (name, division, role, triggers)' });
      }

      // 2. Validate Mandatory Sections
      const hasIdentity = content.includes('## Identity & Role');
      const hasConstraints = content.includes('## Strict Negative Constraints');
      const hasWorkflow = content.includes('## Execution Workflow');
      const hasVerification = content.includes('Verification Gate');

      if (!hasIdentity) failures.push({ file: `${div}/${file}`, error: "Missing required section: '## Identity & Role'" });
      if (!hasConstraints) failures.push({ file: `${div}/${file}`, error: "Missing required section: '## Strict Negative Constraints'" });
      if (!hasWorkflow) failures.push({ file: `${div}/${file}`, error: "Missing required section: '## Execution Workflow'" });
      if (!hasVerification) failures.push({ file: `${div}/${file}`, error: "Missing required section: 'Verification Gate'" });

      // 3. Zero-Slop Check
      for (const pattern of SLOP_PATTERNS) {
        if (pattern.test(content)) {
          failures.push({ file: `${div}/${file}`, error: `Detected forbidden lazy slop pattern: ${pattern}` });
        }
      }
    }
  }

  if (failures.length === 0) {
    console.log(`\x1b[32m\x1b[1m✓ SUCCESS: All ${totalAgents} specialists passed 100% of schema and zero-slop checks!\x1b[0m`);
    console.log(`\x1b[90mEvery agent has valid frontmatter, strict negative constraints, workflows, and verification gates.\x1b[0m\n`);
    process.exit(0);
  } else {
    console.error(`\x1b[31m\x1b[1m✗ FAILED: Found ${failures.length} validation errors:\x1b[0m`);
    for (const f of failures) {
      console.error(`  - \x1b[33m${f.file}\x1b[0m: ${f.error}`);
    }
    process.exit(1);
  }
}

validateAgents();
