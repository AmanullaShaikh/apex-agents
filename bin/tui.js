#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const agentsDir = path.join(ROOT_DIR, 'agents');
const divisions = fs.readdirSync(agentsDir).filter((d) => fs.statSync(path.join(agentsDir, d)).isDirectory());

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  bgBlue: '\x1b[44m\x1b[37m'
};

let selectedDivisionIndex = 0;
let viewMode = 'divisions'; // 'divisions' or 'agents'
let selectedAgentIndex = 0;
let currentAgents = [];

function loadAgentsForDivision(div) {
  const divPath = path.join(agentsDir, div);
  return fs.readdirSync(divPath).filter(f => f.endsWith('.md')).map(f => {
    const content = fs.readFileSync(path.join(divPath, f), 'utf-8');
    const id = f.replace('.md', '');
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return {
      id,
      title: titleMatch ? titleMatch[1] : id,
      content
    };
  });
}

function render() {
  console.clear();
  console.log(`${c.cyan}${c.bold}═════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.cyan}${c.bold}   ⚡ APEX AGENTS: INTERACTIVE TERMINAL STUDIO                    ${c.reset}`);
  console.log(`${c.cyan}${c.bold}═════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.gray}Use [↑/↓] to Navigate • [Enter] to Select • [Esc/Backspace] Back • [Q] Quit${c.reset}\n`);

  if (viewMode === 'divisions') {
    console.log(`${c.bold}SELECT AN ENGINEERING DIVISION (10 Available):${c.reset}\n`);
    divisions.forEach((div, idx) => {
      const isSelected = idx === selectedDivisionIndex;
      const count = fs.readdirSync(path.join(agentsDir, div)).filter(f => f.endsWith('.md')).length;
      const title = div.toUpperCase().replace('-', ' ');

      if (isSelected) {
        console.log(`  ${c.green}${c.bold}▶ ${title.padEnd(35)} (${count} Specialists)${c.reset}`);
      } else {
        console.log(`    ${c.gray}${title.padEnd(35)} (${count} Specialists)${c.reset}`);
      }
    });
  } else {
    const divName = divisions[selectedDivisionIndex].toUpperCase().replace('-', ' ');
    console.log(`${c.magenta}${c.bold}DIVISION: ${divName} (Select a Specialist):${c.reset}\n`);
    currentAgents.forEach((ag, idx) => {
      const isSelected = idx === selectedAgentIndex;
      if (isSelected) {
        console.log(`  ${c.green}${c.bold}▶ @${ag.id.padEnd(32)} ${c.reset}${c.yellow}${ag.title}${c.reset}`);
      } else {
        console.log(`    @${ag.id.padEnd(32)} ${c.gray}${ag.title}${c.reset}`);
      }
    });

    const active = currentAgents[selectedAgentIndex];
    if (active) {
      console.log(`\n${c.cyan}${c.bold}─── SPECIALIST PREVIEW: @${active.id} ───${c.reset}`);
      const previewLines = active.content.split('\n').slice(0, 8).join('\n');
      console.log(`${c.gray}${previewLines}${c.reset}`);
    }
  }
}

// Setup Raw Keyboard Mode
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

process.stdin.on('keypress', (str, key) => {
  if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
    console.clear();
    process.exit(0);
  }

  if (viewMode === 'divisions') {
    if (key.name === 'up') {
      selectedDivisionIndex = (selectedDivisionIndex - 1 + divisions.length) % divisions.length;
      render();
    } else if (key.name === 'down') {
      selectedDivisionIndex = (selectedDivisionIndex + 1) % divisions.length;
      render();
    } else if (key.name === 'return' || key.name === 'right') {
      currentAgents = loadAgentsForDivision(divisions[selectedDivisionIndex]);
      selectedAgentIndex = 0;
      viewMode = 'agents';
      render();
    }
  } else if (viewMode === 'agents') {
    if (key.name === 'up') {
      selectedAgentIndex = (selectedAgentIndex - 1 + currentAgents.length) % currentAgents.length;
      render();
    } else if (key.name === 'down') {
      selectedAgentIndex = (selectedAgentIndex + 1) % currentAgents.length;
      render();
    } else if (key.name === 'escape' || key.name === 'backspace' || key.name === 'left') {
      viewMode = 'divisions';
      render();
    } else if (key.name === 'return') {
      console.clear();
      const active = currentAgents[selectedAgentIndex];
      console.log(`\n${c.green}${c.bold}=== SPECIALIST DIRECTIVE: @${active.id} ===${c.reset}\n`);
      console.log(active.content);
      console.log(`\n${c.yellow}Press [Enter] to return to menu...${c.reset}`);
      process.stdin.once('keypress', () => {
        render();
      });
    }
  }
});

render();
