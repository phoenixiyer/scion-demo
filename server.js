require('dotenv').config();
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Agent Definitions ─────────────────────────────────────────────
// The SCION pitch: vendor-agnostic orchestration.
// Architect & Security run on Gemini CLI (Google), Developer & QA on OpenAI Codex.
// Same grove, same workspace, different harnesses.
const AGENTS = [
  {
    id: 'architect',
    name: 'Architect',
    icon: '🏗️',
    color: '#00d4ff',
    harness: 'gemini-cli',
    model: 'gemini-2.5-flash-lite',
    containerId: `c-${Math.random().toString(36).slice(2, 6)}`,
    systemPrompt: `You are a senior software architect operating as an isolated agent in a multi-agent development grove (powered by Google SCION).
Your role: Produce a concise system design for the given task.
Include: component architecture, API contracts (with actual interface signatures), data models, and 3 key design decisions with rationale.
Format: Clean markdown with headers. Use code blocks for interfaces.
Constraint: Be specific and practical - no generic advice. Under 400 words.`,
  },
  {
    id: 'developer',
    name: 'Developer',
    icon: '💻',
    color: '#00ff88',
    harness: 'openai-codex',
    model: 'gpt-4.1-nano',
    containerId: `c-${Math.random().toString(36).slice(2, 6)}`,
    systemPrompt: `You are a senior software developer operating as an isolated agent in a multi-agent development grove (powered by Google SCION).
Your role: Implement the core solution with clean, production-ready code.
Choose the most appropriate language/framework. Include inline comments for complex logic.
Deliver working code - not pseudocode. Focus on the core implementation.
Constraint: Ship the most critical 2-3 files. Under 400 words.`,
  },
  {
    id: 'security',
    name: 'Security Auditor',
    icon: '🔒',
    color: '#ff6b35',
    harness: 'gemini-cli',
    model: 'gemini-2.5-flash-lite',
    containerId: `c-${Math.random().toString(36).slice(2, 6)}`,
    systemPrompt: `You are a security engineer operating as an isolated agent in a multi-agent development grove (powered by Google SCION).
Your role: Perform a threat analysis for the given coding task.
Identify the top 5 security risks. For each: name the threat, explain the attack vector, rate severity (Critical/High/Medium/Low), and provide a specific mitigation with a code snippet.
Use OWASP categories where relevant.
Constraint: Be specific and actionable. Under 400 words.`,
  },
  {
    id: 'qa',
    name: 'QA Engineer',
    icon: '🧪',
    color: '#b366ff',
    harness: 'openai-codex',
    model: 'gpt-4.1-nano',
    containerId: `c-${Math.random().toString(36).slice(2, 6)}`,
    systemPrompt: `You are a QA engineer operating as an isolated agent in a multi-agent development grove (powered by Google SCION).
Your role: Design a comprehensive test strategy for the given task.
Include: 3 unit tests for core logic, 2 integration tests, 2 edge cases, and 1 performance test scenario.
Write actual test code using an appropriate framework (Jest, pytest, or Go testing).
Constraint: Focus on high-value test cases. Under 400 words.`,
  },
];

// ─── Helper: Send SSE event ────────────────────────────────────────
function sendEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ─── Helper: Simulate Skill Events ─────────────────────────────────
const AGENT_SKILLS = {
  architect: ['read_file(schema.gql)', 'search_repo(REST API)', 'read_file(architecture.md)'],
  developer: ['write_file(auth.js)', 'npm install', 'run_linter()', 'git commit'],
  security: ['scan_dependencies()', 'read_file(auth.js)', 'run_sast()', 'check_owasp()'],
  qa: ['read_file(auth.js)', 'write_file(auth.spec.js)', 'npm test', 'generate_mock_data()']
};

function emitRandomSkill(agent, res) {
  const skills = AGENT_SKILLS[agent.id] || ['execute_script()'];
  const skill = skills[Math.floor(Math.random() * skills.length)];
  sendEvent(res, 'agent-skill', { agentId: agent.id, skill });
}

// ─── Gemini Harness (Google) ───────────────────────────────────────
async function runGeminiAgent(agent, task, res) {
  const startTime = Date.now();
  sendEvent(res, 'agent-start', { agentId: agent.id });

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: agent.model,
      systemInstruction: agent.systemPrompt,
    });

    const result = await model.generateContentStream(task);

    let chunkCount = 0;
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        sendEvent(res, 'agent-chunk', { agentId: agent.id, text });
      }
      if (++chunkCount % 12 === 0 && Math.random() > 0.5) {
        emitRandomSkill(agent, res);
      }
    }

    const response = await result.response;
    const usage = response.usageMetadata;
    const latency = Date.now() - startTime;

    sendEvent(res, 'agent-complete', {
      agentId: agent.id,
      promptTokens: usage?.promptTokenCount || 0,
      completionTokens: usage?.candidatesTokenCount || 0,
      totalTokens: usage?.totalTokenCount || 0,
      latencyMs: latency,
    });
  } catch (error) {
    console.error(`Agent ${agent.id} (Gemini) error:`, error.message);
    sendEvent(res, 'agent-error', {
      agentId: agent.id,
      error: error.message || 'Unknown Gemini error',
    });
  }
}

// ─── OpenAI Harness (Codex) ───────────────────────────────────────
async function runOpenAIAgent(agent, task, res) {
  const startTime = Date.now();
  sendEvent(res, 'agent-start', { agentId: agent.id });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: agent.model,
        stream: true,
        max_tokens: 1200,
        stream_options: { include_usage: true },
        messages: [
          { role: 'system', content: agent.systemPrompt },
          { role: 'user', content: task },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenAI API ${response.status}: ${errBody.slice(0, 200)}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let totalCompletionTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') continue;

        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            sendEvent(res, 'agent-chunk', { agentId: agent.id, text: delta });
            totalCompletionTokens += Math.ceil(delta.length / 4); // rough estimate
            
            if (totalCompletionTokens % 50 === 0 && Math.random() > 0.7) {
              emitRandomSkill(agent, res);
            }
          }

          // Check for usage in final chunk
          if (parsed.usage) {
            totalCompletionTokens = parsed.usage.completion_tokens || totalCompletionTokens;
            // Capture prompt usage
            if (parsed.usage.prompt_tokens) {
              agent._promptTokens = parsed.usage.prompt_tokens;
            }
          }
        } catch (e) { /* skip malformed chunks */ }
      }
    }

    const latency = Date.now() - startTime;
    sendEvent(res, 'agent-complete', {
      agentId: agent.id,
      promptTokens: agent._promptTokens || 50,
      completionTokens: totalCompletionTokens,
      totalTokens: (agent._promptTokens || 50) + totalCompletionTokens,
      latencyMs: latency,
    });
  } catch (error) {
    console.error(`Agent ${agent.id} (OpenAI) error:`, error.message);
    sendEvent(res, 'agent-error', {
      agentId: agent.id,
      error: error.message || 'Unknown OpenAI error',
    });
  }
}

// ─── Agent Router ──────────────────────────────────────────────────
function runAgent(agent, task, res) {
  if (agent.harness === 'gemini-cli') {
    return runGeminiAgent(agent, task, res);
  } else if (agent.harness === 'openai-codex') {
    return runOpenAIAgent(agent, task, res);
  }
  throw new Error(`Unknown harness: ${agent.harness}`);
}

// ─── Main Orchestration Endpoint ───────────────────────────────────
app.post('/api/orchestrate', async (req, res) => {
  const { task } = req.body;

  if (!task || !task.trim()) {
    return res.status(400).json({ error: 'Task is required' });
  }

  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  if (!hasGemini && !hasOpenAI) {
    return res.status(500).json({ error: 'No API keys configured. Add GEMINI_API_KEY and/or OPENAI_API_KEY to .env' });
  }

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const groveId = `grove-${Date.now().toString(36)}`;
  const startTime = Date.now();

  // Phase 1: Initialize grove
  sendEvent(res, 'grove-init', {
    groveId,
    timestamp: new Date().toISOString(),
    task: task.trim(),
  });

  // Filter agents by available keys
  const activeAgents = AGENTS.filter((a) => {
    if (a.harness === 'gemini-cli') return hasGemini;
    if (a.harness === 'openai-codex') return hasOpenAI;
    return false;
  });

  // Phase 2: Spawn agents (staggered for visual effect)
  for (const agent of activeAgents) {
    sendEvent(res, 'agent-spawn', {
      agentId: agent.id,
      name: agent.name,
      icon: agent.icon,
      color: agent.color,
      containerId: agent.containerId,
      harness: agent.harness,
      model: agent.model,
    });
    await new Promise((r) => setTimeout(r, 200));
  }

  // Phase 3: Run all agents in parallel
  const promises = activeAgents.map((agent) => runAgent(agent, task.trim(), res));
  await Promise.allSettled(promises);

  // Phase 4: Orchestration complete
  const totalLatency = Date.now() - startTime;
  sendEvent(res, 'orchestration-complete', {
    groveId,
    totalLatencyMs: totalLatency,
    agentCount: activeAgents.length,
  });

  res.end();
});

// ─── Health check ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    agents: AGENTS.map((a) => ({ id: a.id, name: a.name, harness: a.harness, model: a.model })),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    openaiConfigured: !!process.env.OPENAI_API_KEY,
  });
});

// ─── Start server ──────────────────────────────────────────────────
app.listen(PORT, () => {
  const g = process.env.GEMINI_API_KEY ? '✓' : '✗';
  const o = process.env.OPENAI_API_KEY ? '✓' : '✗';
  console.log(`\n  ◆ SCION Multi-Agent Demo`);
  console.log(`  ├─ http://localhost:${PORT}`);
  console.log(`  ├─ Harnesses:`);
  console.log(`  │  ├─ Gemini CLI  (gemini-2.5-flash-lite) ${g}`);
  console.log(`  │  └─ OpenAI Codex (gpt-4.1-nano)         ${o}`);
  console.log(`  ├─ Agents:`);
  AGENTS.forEach((a, i) => {
    const last = i === AGENTS.length - 1;
    console.log(`  │  ${last ? '└' : '├'}─ ${a.icon} ${a.name} → ${a.harness} (${a.model})`);
  });
  console.log(`  └─ Keys: Gemini ${g} | OpenAI ${o}\n`);
});
