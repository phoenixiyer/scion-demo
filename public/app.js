/* ═══════════════════════════════════════════════════════════════════
   SCION Multi-Agent Orchestration Demo — Client Application
   ═══════════════════════════════════════════════════════════════════ */

// ─── State ───────────────────────────────────────────────────────
const state = {
  isRunning: false,
  mode: 'chaos', // 'chaos' or 'scion'
  startTime: null,
  timerInterval: null,
  agents: {},
  completedCount: 0,
  totalTokens: 0,
  chaosText: '',
  chaosChunkCount: 0,
  lastChaosAgent: null,
  chaosWarningTimeout: null,
};

// ─── Agent Definitions ───────────────────────────────────────────
const AGENT_DEFS = {
  architect: { name: 'Architect', icon: '🏗️', color: '#00d4ff', harness: 'gemini-cli', model: 'gemini-2.5-flash-lite' },
  developer: { name: 'Developer', icon: '💻', color: '#00ff88', harness: 'openai-codex', model: 'gpt-4.1-nano' },
  security:  { name: 'Security Auditor', icon: '🔒', color: '#ff6b35', harness: 'gemini-cli', model: 'gemini-2.5-flash-lite' },
  qa:        { name: 'QA Engineer', icon: '🧪', color: '#b366ff', harness: 'openai-codex', model: 'gpt-4.1-nano' },
};

// Harness display config
const HARNESS_LABELS = {
  'gemini-cli': { label: 'Gemini CLI', badge: '◆', badgeClass: 'harness-gemini' },
  'openai-codex': { label: 'OpenAI Codex', badge: '◇', badgeClass: 'harness-openai' },
};

// Chaos warning messages (simulated conflicts)
const CHAOS_WARNINGS = [
  '⚠️ CONFLICT: Two agents writing to auth.js simultaneously',
  '🔴 COLLISION: Security agent overwriting Developer output',
  '⚠️ RACE CONDITION: QA reading stale Architect design',
  '🔴 CREDENTIAL LEAK: Shared .env exposed to all agents',
  '⚠️ MERGE CONFLICT: Architect and Developer disagree on API contract',
  '🔴 COST SPIKE: Cannot attribute $0.12 to any specific agent',
  '⚠️ OUTPUT CORRUPTION: Interleaved streams — who wrote this?',
  '🔴 DEADLOCK: Security scanning Developer code while Developer rewrites',
];

// ─── DOM References ──────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const taskInput     = $('#taskInput');
const launchBtn     = $('#launchBtn');
const agentsGrid    = $('#agentsGrid');
const groveStatus   = $('#groveStatus');
const groveIdEl     = $('#groveId');
const groveTaskEl   = $('#groveTask');
const metricsBar    = $('#metricsBar');
const metricTokens  = $('#metricTokens');
const metricCost    = $('#metricCost');
const metricAgents  = $('#metricAgents');
const metricTime    = $('#metricTime');
const toastsEl      = $('#toasts');
const chaosContainer = $('#chaosContainer');
const chaosOutput   = $('#chaosOutput');
const chaosWarnings = $('#chaosWarnings');
const chaosCost     = $('#chaosCost');
const subtitleText  = $('#subtitleText');

// ─── Initialization ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderPlaceholderCards();
  bindEvents();
  setMode('chaos'); // Start in chaos mode to show the problem first
});

function bindEvents() {
  launchBtn.addEventListener('click', handleLaunch);
  taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !state.isRunning) handleLaunch();
  });

  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      taskInput.value = btn.dataset.task;
      taskInput.focus();
    });
  });

  // Mode toggle
  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.isRunning) return; // Don't switch while running
      setMode(btn.dataset.mode);
    });
  });
}

// ─── Mode Switching ──────────────────────────────────────────────
function setMode(mode) {
  state.mode = mode;

  // Update toggle buttons
  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  if (mode === 'chaos') {
    chaosContainer.style.display = 'flex';
    agentsGrid.style.display = 'none';
    subtitleText.textContent = 'What happens when 4 AI agents share one workspace with zero isolation?';
    launchBtn.querySelector('.btn-text').textContent = 'Run Without Isolation';
    launchBtn.style.background = 'linear-gradient(135deg, #ff5050, #ff8c00)';
  } else {
    chaosContainer.style.display = 'none';
    agentsGrid.style.display = 'grid';
    subtitleText.textContent = 'Watch 4 specialized AI agents collaborate — each in its own isolated container, running in parallel.';
    launchBtn.querySelector('.btn-text').textContent = 'Launch Grove';
    launchBtn.style.background = 'linear-gradient(135deg, var(--architect), #00a8cc)';
  }
}

// ─── Placeholder Cards ──────────────────────────────────────────
function renderPlaceholderCards() {
  agentsGrid.innerHTML = Object.entries(AGENT_DEFS)
    .map(([id, agent]) => createAgentCardHTML(id, agent, null))
    .join('');
}

function createAgentCardHTML(id, agent, containerId) {
  const harness = HARNESS_LABELS[agent.harness] || { label: agent.harness, badge: '●', badgeClass: '' };
  return `
    <div class="agent-card" id="card-${id}" style="--agent-color: ${agent.color}">
      <div class="agent-header">
        <div class="agent-identity">
          <span class="agent-icon">${agent.icon}</span>
          <span class="agent-name">${agent.name}</span>
          <span class="harness-badge ${harness.badgeClass}" id="harness-${id}">${harness.badge} ${harness.label}</span>
        </div>
        <div class="agent-badges">
          <span class="container-id" id="cid-${id}">${containerId || '—'}</span>
          <span class="status-badge idle" id="status-${id}">
            <span class="status-dot"></span>
            <span>Idle</span>
          </span>
        </div>
      </div>
      <div class="agent-output" id="output-${id}">
        <div class="output-placeholder">Waiting for task...</div>
      </div>
      <div class="agent-footer">
        <span class="token-count" id="tokens-${id}">0 tokens</span>
        <span class="agent-latency" id="latency-${id}"></span>
        <span class="agent-model" id="model-${id}">${agent.model}</span>
      </div>
    </div>
  `;
}

// ─── Launch Orchestration ────────────────────────────────────────
async function handleLaunch() {
  const task = taskInput.value.trim();
  if (!task || state.isRunning) return;

  resetState();
  state.isRunning = true;
  launchBtn.disabled = true;

  if (state.mode === 'chaos') {
    launchBtn.querySelector('.btn-text').textContent = 'Chaos in progress...';
  } else {
    launchBtn.querySelector('.btn-text').textContent = 'Running...';
  }

  try {
    const response = await fetch('/api/orchestrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task }),
    });

    if (!response.ok) {
      const err = await response.json();
      showToast('❌', err.error || 'Server error');
      endRun();
      return;
    }

    // Read the SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = null;
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7);
        } else if (line.startsWith('data: ') && currentEvent) {
          try {
            const data = JSON.parse(line.slice(6));
            handleEvent(currentEvent, data);
          } catch (e) { /* ignore malformed JSON */ }
          currentEvent = null;
        }
      }
    }
  } catch (err) {
    showToast('❌', `Connection error: ${err.message}`);
  }

  endRun();
}

// ─── State Management ────────────────────────────────────────────
function resetState() {
  state.agents = {};
  state.completedCount = 0;
  state.totalTokens = 0;
  state.chaosText = '';
  state.chaosChunkCount = 0;
  state.lastChaosAgent = null;
  state.startTime = Date.now();

  if (state.mode === 'chaos') {
    // Reset chaos view
    chaosOutput.innerHTML = '<div class="output-text"><span class="chaos-cursor"></span></div>';
    chaosWarnings.innerHTML = '';
    chaosCost.textContent = '$??? total (no breakdown)';
    chaosContainer.classList.remove('active');
  } else {
    // Reset SCION cards
    renderPlaceholderCards();
  }

  // Show UI elements
  groveStatus.style.display = 'none';
  metricsBar.style.display = 'flex';
  updateMetrics();

  // Start timer
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = setInterval(updateTimer, 100);
}

function endRun() {
  state.isRunning = false;
  launchBtn.disabled = false;

  if (state.mode === 'chaos') {
    launchBtn.querySelector('.btn-text').textContent = 'Run Without Isolation';
    // Remove chaos cursor
    const cursor = chaosOutput.querySelector('.chaos-cursor');
    if (cursor) cursor.remove();
  } else {
    launchBtn.querySelector('.btn-text').textContent = 'Launch Grove';
  }

  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  updateTimer();
}

// ─── Event Handlers ──────────────────────────────────────────────
function handleEvent(event, data) {
  if (state.mode === 'chaos') {
    handleChaosEvent(event, data);
  } else {
    handleScionEvent(event, data);
  }
}

// ─── CHAOS MODE Event Handlers ───────────────────────────────────
function handleChaosEvent(event, data) {
  switch (event) {
    case 'grove-init':
      groveStatus.style.display = 'flex';
      groveIdEl.textContent = '⚠️ NO GROVE (shared workspace)';
      groveTaskEl.textContent = data.task;
      showToast('💥', 'All agents dumped into shared workspace');
      break;

    case 'agent-spawn':
      chaosContainer.classList.add('active');
      // Don't show individual agent info — that's the point
      break;

    case 'agent-start':
      state.agents[data.agentId] = state.agents[data.agentId] || { text: '', tokens: 0, status: 'active' };
      break;

    case 'agent-chunk':
      appendChaosChunk(data.agentId, data.text);
      break;

    case 'agent-complete':
      state.completedCount++;
      state.totalTokens += (data.totalTokens || 0);
      updateMetrics();
      // In chaos mode — no attribution. Just "something finished"
      chaosCost.textContent = `$${((state.totalTokens / 1_000_000) * 0.25).toFixed(4)} (which agent? 🤷)`;
      break;

    case 'agent-error':
      state.completedCount++;
      updateMetrics();
      // Error with no attribution
      showToast('⚠️', `An agent failed — but which one? No isolation = no clue.`);
      break;

    case 'orchestration-complete':
      showToast('💥', `Done — but look at that output. Can you tell who wrote what?`);
      // Fire one final warning
      spawnChaosWarning('🔴 RESULT: Interleaved output is unusable. Good luck debugging.');
      break;
  }
}

function appendChaosChunk(agentId, text) {
  state.chaosChunkCount++;

  // Every ~8 chunks from a different agent, trigger a warning
  if (state.lastChaosAgent && state.lastChaosAgent !== agentId && state.chaosChunkCount % 8 === 0) {
    const warning = CHAOS_WARNINGS[Math.floor(Math.random() * CHAOS_WARNINGS.length)];
    spawnChaosWarning(warning);

    // Trigger glitch effect
    chaosOutput.classList.add('glitch');
    setTimeout(() => chaosOutput.classList.remove('glitch'), 150);
  }

  state.lastChaosAgent = agentId;

  const textEl = chaosOutput.querySelector('.output-text');
  if (!textEl) return;

  // Append with agent color but NO label — you can't tell who wrote what
  const span = document.createElement('span');
  span.className = 'chaos-agent-text';
  span.dataset.agent = agentId;
  span.textContent = text;

  // Insert before cursor
  const cursor = textEl.querySelector('.chaos-cursor');
  if (cursor) {
    textEl.insertBefore(span, cursor);
  } else {
    textEl.appendChild(span);
  }

  chaosOutput.scrollTop = chaosOutput.scrollHeight;
}

function spawnChaosWarning(message) {
  const el = document.createElement('div');
  el.className = 'chaos-warning';
  el.textContent = message;
  chaosWarnings.appendChild(el);

  // Remove after 4 seconds
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 500);
  }, 4000);

  // Keep max 3 warnings
  while (chaosWarnings.children.length > 3) {
    chaosWarnings.firstChild.remove();
  }
}

// ─── SCION MODE Event Handlers ───────────────────────────────────
function handleScionEvent(event, data) {
  switch (event) {
    case 'grove-init':
      groveStatus.style.display = 'flex';
      groveIdEl.textContent = data.groveId;
      groveTaskEl.textContent = data.task;
      showToast('🌿', `Grove ${data.groveId} initialized`);
      break;

    case 'agent-spawn':
      spawnAgent(data);
      break;

    case 'agent-start':
      activateAgent(data.agentId);
      break;

    case 'agent-chunk':
      appendChunk(data.agentId, data.text);
      break;

    case 'agent-complete':
      completeAgent(data);
      break;

    case 'agent-error':
      errorAgent(data.agentId, data.error);
      break;

    case 'orchestration-complete':
      showToast('✅', `All agents complete — ${formatMs(data.totalLatencyMs)}`);
      break;
  }
}

function spawnAgent(data) {
  const card = document.getElementById(`card-${data.agentId}`);
  if (!card) return;

  state.agents[data.agentId] = {
    tokens: 0,
    text: '',
    status: 'spawned',
    harness: data.harness,
    model: data.model,
  };

  // Set container ID
  const cidEl = document.getElementById(`cid-${data.agentId}`);
  if (cidEl) cidEl.textContent = data.containerId;

  // Update harness badge from server
  if (data.harness) {
    const harnessEl = document.getElementById(`harness-${data.agentId}`);
    const harnessInfo = HARNESS_LABELS[data.harness];
    if (harnessEl && harnessInfo) {
      harnessEl.className = `harness-badge ${harnessInfo.badgeClass}`;
      harnessEl.textContent = `${harnessInfo.badge} ${harnessInfo.label}`;
    }
  }

  // Update model label from server
  if (data.model) {
    const modelEl = document.getElementById(`model-${data.agentId}`);
    if (modelEl) modelEl.textContent = data.model;
  }

  const hLabel = HARNESS_LABELS[data.harness]?.label || data.harness;
  showToast(data.icon, `${data.name} → ${hLabel} (${data.containerId})`);
}

function activateAgent(agentId) {
  const card = document.getElementById(`card-${agentId}`);
  if (!card) return;

  card.classList.add('active');
  if (!state.agents[agentId]) {
    state.agents[agentId] = { tokens: 0, text: '', status: 'active' };
  }
  state.agents[agentId].status = 'active';

  // Update status badge
  const statusEl = document.getElementById(`status-${agentId}`);
  if (statusEl) {
    statusEl.className = 'status-badge active';
    statusEl.innerHTML = '<span class="status-dot"></span><span>Running</span>';
  }

  // Clear placeholder and add cursor
  const outputEl = document.getElementById(`output-${agentId}`);
  if (outputEl) {
    outputEl.innerHTML = '<div class="output-text"><span class="cursor"></span></div>';
  }
}

function appendChunk(agentId, text) {
  const outputEl = document.getElementById(`output-${agentId}`);
  if (!outputEl) return;

  const agent = state.agents[agentId];
  if (!agent) return;

  agent.text += text;

  // Render with simple markdown
  const textEl = outputEl.querySelector('.output-text');
  if (textEl) {
    textEl.innerHTML = renderMarkdown(agent.text) + '<span class="cursor"></span>';
    outputEl.scrollTop = outputEl.scrollHeight;
  }
}

function completeAgent(data) {
  const card = document.getElementById(`card-${data.agentId}`);
  if (!card) return;

  card.classList.remove('active');
  card.classList.add('complete');

  const agent = state.agents[data.agentId];
  if (agent) {
    agent.status = 'complete';
    agent.tokens = data.totalTokens || 0;
  }

  // Remove cursor
  const cursor = card.querySelector('.cursor');
  if (cursor) cursor.remove();

  // Update status badge
  const statusEl = document.getElementById(`status-${data.agentId}`);
  if (statusEl) {
    statusEl.className = 'status-badge complete';
    statusEl.innerHTML = '<span class="status-dot"></span><span>Done</span>';
  }

  // Update tokens
  const tokensEl = document.getElementById(`tokens-${data.agentId}`);
  if (tokensEl) tokensEl.textContent = `${(data.totalTokens || 0).toLocaleString()} tokens`;

  // Update latency
  const latencyEl = document.getElementById(`latency-${data.agentId}`);
  if (latencyEl) latencyEl.textContent = formatMs(data.latencyMs);

  // Update global metrics
  state.completedCount++;
  state.totalTokens += (data.totalTokens || 0);
  updateMetrics();

  const def = AGENT_DEFS[data.agentId];
  if (def) {
    showToast('✓', `${def.name} complete — ${(data.totalTokens || 0).toLocaleString()} tokens`);
  }
}

function errorAgent(agentId, error) {
  const card = document.getElementById(`card-${agentId}`);
  if (!card) return;

  card.classList.remove('active');
  card.classList.add('error');

  // Remove cursor
  const cursor = card.querySelector('.cursor');
  if (cursor) cursor.remove();

  // Update status
  const statusEl = document.getElementById(`status-${agentId}`);
  if (statusEl) {
    statusEl.className = 'status-badge error';
    statusEl.innerHTML = '<span class="status-dot"></span><span>Error</span>';
  }

  // Show error in output
  const outputEl = document.getElementById(`output-${agentId}`);
  if (outputEl) {
    const textEl = outputEl.querySelector('.output-text');
    if (textEl) {
      textEl.innerHTML += `<br><br><strong style="color:#ff5050">Error:</strong> ${escapeHtml(error)}`;
    }
  }

  state.completedCount++;
  updateMetrics();
  showToast('⚠️', `${AGENT_DEFS[agentId]?.name || agentId} error: ${error.slice(0, 60)}`);
}

// ─── Metrics ─────────────────────────────────────────────────────
function updateMetrics() {
  metricTokens.textContent = state.totalTokens.toLocaleString();
  // Blended avg: Gemini 2.5 Flash-Lite ($0.10/$0.40 per 1M) + GPT-4.1 Nano ($0.10/$0.40 per 1M)
  const cost = (state.totalTokens / 1_000_000) * 0.25;
  metricCost.textContent = cost.toFixed(4);
  metricAgents.textContent = `${state.completedCount} / 4`;
}

function updateTimer() {
  if (!state.startTime) return;
  const elapsed = (Date.now() - state.startTime) / 1000;
  metricTime.textContent = elapsed.toFixed(1) + 's';
}

// ─── Toast Notifications ─────────────────────────────────────────
function showToast(icon, message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHtml(message)}</span>`;
  toastsEl.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 3500);

  // Keep max 5 toasts
  while (toastsEl.children.length > 5) {
    toastsEl.firstChild.remove();
  }
}

// ─── Simple Markdown Renderer ────────────────────────────────────
function renderMarkdown(text) {
  let html = escapeHtml(text);

  // Code blocks (```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="lang-${lang}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

  // Lists
  html = html.replace(/^- (.+)$/gm, '• $1');
  html = html.replace(/^\d+\. (.+)$/gm, '  $1');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border-subtle);margin:12px 0">');

  // Newlines
  html = html.replace(/\n/g, '<br>');

  return html;
}

// ─── Utilities ───────────────────────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatMs(ms) {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
