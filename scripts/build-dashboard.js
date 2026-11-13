#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const agentsDir = path.join(ROOT_DIR, 'agents');
const divisions = fs.readdirSync(agentsDir).filter((d) => fs.statSync(path.join(agentsDir, d)).isDirectory());

const allAgents = [];

for (const div of divisions) {
  const divPath = path.join(agentsDir, div);
  const files = fs.readdirSync(divPath).filter((f) => f.endsWith('.md'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(divPath, file), 'utf-8');
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const id = file.replace('.md', '');
    let role = id;
    let divisionName = div;
    let triggers = `@${id}`;

    if (fmMatch) {
      const lines = fmMatch[1].split('\n');
      for (const line of lines) {
        if (line.startsWith('role:')) role = line.replace('role:', '').trim();
        if (line.startsWith('division:')) divisionName = line.replace('division:', '').trim();
        if (line.startsWith('triggers:')) triggers = line.replace('triggers:', '').trim();
      }
    }

    allAgents.push({
      id,
      division: divisionName,
      role,
      triggers,
      content
    });
  }
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Apex Agents Explorer | Autonomous AI Engineering Agency</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #080a10; color: #e2e8f0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #0b0e17; }
    ::-webkit-scrollbar-thumb { background: #1e2538; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #333f5c; }
  </style>
</head>
<body class="min-h-screen flex flex-col selection:bg-blue-600 selection:text-white">

  <!-- Header -->
  <header class="border-b border-slate-800/80 bg-slate-950/80 sticky top-0 z-50 backdrop-blur-md px-6 py-4">
    <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
          ⚡
        </div>
        <div>
          <h1 class="font-bold text-slate-100 text-sm tracking-tight flex items-center gap-2">
            Apex Agents Explorer
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">v1.1.0</span>
          </h1>
          <p class="text-xs text-slate-400">34 Autonomous Specialists across 10 Divisions • MIT Open Source</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <a href="https://github.com/AmanullaShaikh/apex-agents" target="_blank" class="px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold transition-all">
          Star on GitHub ⭐
        </a>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-6">
    <!-- Search and Filter Bar -->
    <div class="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800">
      <input
        type="text"
        id="searchInput"
        placeholder="Search specialists by name, division, or keyword (e.g. database, security, cwv)..."
        class="w-full sm:w-96 px-4 py-2 rounded-lg bg-black/60 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
      />
      <div class="flex items-center gap-2 text-xs text-slate-400 font-mono">
        Showing <span id="countSpan" class="text-emerald-400 font-bold">${allAgents.length}</span> of ${allAgents.length} Specialists
      </div>
    </div>

    <!-- Agent Grid -->
    <div id="agentGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>
  </main>

  <footer class="border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500">
    Built by <strong>Amanulla Shaikh</strong> for the global autonomous AI engineering community.
  </footer>

  <script>
    const agents = ${JSON.stringify(allAgents, null, 2)};
    const grid = document.getElementById('agentGrid');
    const searchInput = document.getElementById('searchInput');
    const countSpan = document.getElementById('countSpan');

    function renderAgents(list) {
      grid.innerHTML = '';
      countSpan.textContent = list.length;

      for (const ag of list) {
        const card = document.createElement('div');
        card.className = 'p-5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3';
        
        card.innerHTML = \`
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold uppercase tracking-wider text-blue-400 font-mono">\${ag.division}</span>
              <span class="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">\${ag.triggers}</span>
            </div>
            <h3 class="text-sm font-bold text-white">\${ag.id}</h3>
            <p class="text-xs text-slate-300 line-clamp-2">\${ag.role}</p>
          </div>

          <div class="pt-2 border-t border-slate-800 flex items-center justify-between">
            <button onclick="copyPrompt('\${ag.id}')" class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all">
              Copy Prompt 📋
            </button>
            <span class="text-[10px] text-slate-500 font-mono">Zero-Slop Certified</span>
          </div>
        \`;
        grid.appendChild(card);
      }
    }

    window.copyPrompt = function(id) {
      const ag = agents.find(a => a.id === id);
      if (ag) {
        navigator.clipboard.writeText(ag.content);
        alert('Copied ' + id + ' prompt to clipboard!');
      }
    };

    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = agents.filter(a => 
        a.id.toLowerCase().includes(q) || 
        a.division.toLowerCase().includes(q) || 
        a.role.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q)
      );
      renderAgents(filtered);
    });

    renderAgents(agents);
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT_DIR, 'dashboard.html'), html);
console.log(`[Apex-Agents] Generated interactive dashboard.html with ${allAgents.length} specialists!`);
