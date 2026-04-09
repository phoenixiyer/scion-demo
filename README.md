# 🔮 SCION Multi-Agent Orchestration Demo

A real-time visual demo of **vendor-agnostic multi-agent orchestration** : the core concept behind [Google SCION](https://github.com/GoogleCloudPlatform/scion), an open-source "hypervisor for AI agents."

Watch 4 specialized AI agents work on the same coding task **simultaneously**, each powered by a different AI provider and model, exactly the kind of mixed-vendor orchestration SCION enables.

> **⚠️ This is a concept demo, not a SCION deployment.**  
> This project demonstrates *the architectural pattern* SCION introduces : isolated, vendor-agnostic, concurrent AI agents with per-agent telemetry. It does not run SCION's actual Go runtime, containers, or Hub infrastructure. Think of it as a visual explainer of *why* SCION matters.

## What SCION Solves (and What This Demo Shows)

Most teams deploying multiple AI agents hit the same wall:
- Agents overwrite each other's files
- No credential isolation between agent processes
- No way to attribute cost per agent
- Locked into a single AI vendor

SCION's answer: **treat agents like VMs** : isolate them in containers, give each its own credentials and workspace, and orchestrate them through a vendor-agnostic layer.

### The Chaos Simulator (Before vs. After)

This demo features a built-in **Mode Toggle** so you can see the problem and the solution side-by-side:

*   💥 **Traditional AI (The Problem):** Watch what happens when you dump 4 agents into the same shared workspace. No isolation, no attribution, shared credentials, and text streams violently interlacing. It is absolute chaos.
*   🌿 **SCION Isolation (The Solution):** Switch to SCION mode to see those same 4 agents smoothly sandboxed into their own containers with independent telemetry, identities, and vendor harnesses.

This demo makes that pattern tangible:

| SCION Concept | What SCION Does | What This Demo Shows |
|---------------|-----------------|----------------------|
| **Harness** | Adapter for different agent types | Gemini CLI + OpenAI Codex running side by side |
| **Grove** | Project namespace grouping agents | Session ID grouping 4 agents on one task |
| **Template** | Role definition (system prompt + skills) | Specialized system prompts per agent |
| **Container Isolation** | Each agent in its own container | Each agent with own identity, telemetry, output |
| **OTEL Telemetry** | Per-agent observability | Live token counts + latency per agent |
| **Vendor Agnostic** | Claude Code, Gemini CLI, Codex | Gemini + OpenAI in the same orchestration |

## Agents & Models

The demo runs **2 different AI providers in parallel** : the headline feature of SCION's harness architecture:

| Agent | Role | Harness | Model | Pricing |
|-------|------|---------|-------|---------|
| 🏗️ **Architect** | System design, API contracts | Gemini CLI | `gemini-2.5-flash-lite` | $0.10 / $0.40 per 1M tokens |
| 💻 **Developer** | Production code implementation | OpenAI Codex | `gpt-4.1-nano` | $0.10 / $0.40 per 1M tokens |
| 🔒 **Security Auditor** | Threat analysis, OWASP mitigations | Gemini CLI | `gemini-2.5-flash-lite` | $0.10 / $0.40 per 1M tokens |
| 🧪 **QA Engineer** | Test strategy, edge cases | OpenAI Codex | `gpt-4.1-nano` | $0.10 / $0.40 per 1M tokens |

**Why these models?** Both `gemini-2.5-flash-lite` and `gpt-4.1-nano` are the cheapest production-grade models from each vendor (as of April 2026). Running 4 agents on a single task costs fractions of a cent.

## Quick Start

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/scion-multi-agent-demo.git
cd scion-multi-agent-demo

# 2. Install
npm install

# 3. Configure API keys
cp .env.example .env
# Edit .env - add your Gemini and/or OpenAI keys

# 4. Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) - enter a coding task or click a preset.

> **Keys are optional per provider.** If you only have a Gemini key, only the Gemini-powered agents will run (and vice versa). Both keys = full 4-agent demo.

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  Browser (SSE Client)                                      │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ 🏗 Architect  │  │ 💻 Developer  │                        │
│  │ ◆ Gemini CLI │  │ ◇ OpenAI     │                        │
│  └──────▲───────┘  └──────▲───────┘                        │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ 🔒 Security   │  │ 🧪 QA        │                        │
│  │ ◆ Gemini CLI │  │ ◇ OpenAI     │                        │
│  └──────▲───────┘  └──────▲───────┘                        │
│         │                  │                                │
│         └────────┬─────────┘                                │
│                  │ SSE Event Stream                         │
├──────────────────┼─────────────────────────────────────────┤
│  Express Server  │  (Orchestration Layer)                   │
│                  │                                          │
│  ┌───────────────┴────────────────┐                        │
│  │  POST /api/orchestrate         │                        │
│  │                                │                        │
│  │  ┌─ Gemini Harness ─────────┐  │                        │
│  │  │ gemini-2.5-flash-lite    │  │  ← Google AI Studio    │
│  │  │ Architect + Security     │  │                        │
│  │  └──────────────────────────┘  │                        │
│  │                                │                        │
│  │  ┌─ OpenAI Harness ─────────┐  │                        │
│  │  │ gpt-4.1-nano             │  │  ← OpenAI API         │
│  │  │ Developer + QA           │  │                        │
│  │  └──────────────────────────┘  │                        │
│  └────────────────────────────────┘                        │
│                                                            │
│  All 4 agents run in parallel. Each has its own:           │
│  • Container ID (isolated identity)                        │
│  • System prompt (role specialization)                     │
│  • Token telemetry (cost attribution)                      │
│  • Streaming output (independent channels)                 │
└────────────────────────────────────────────────────────────┘
```

## How It Maps to SCION

| This Demo | SCION Equivalent | Why It Matters |
|-----------|------------------|----------------|
| `runGeminiAgent()` / `runOpenAIAgent()` | **Harness adapters** | Same orchestration layer, different AI backends |
| Session `grove-*` ID | **Grove** | Project namespace for agent groups |
| Agent system prompts | **Templates** | Role-based specialization per agent |
| Unique `c-*` container IDs | **Container isolation** | Each agent has its own identity |
| Per-agent token counts | **OTEL telemetry** | Attribute cost and usage per agent |
| `Promise.allSettled()` parallel execution | **Concurrent orchestration** | All agents work simultaneously |

## Tech Stack

- **Backend:** Node.js + Express
- **Gemini Harness:** `@google/generative-ai` SDK → `gemini-2.5-flash-lite`
- **OpenAI Harness:** OpenAI Chat Completions API → `gpt-4.1-nano`
- **Frontend:** Vanilla HTML/CSS/JS (zero framework dependencies)
- **Streaming:** Server-Sent Events (SSE)

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | At least one | [Google AI Studio](https://aistudio.google.com/apikey) API key |
| `OPENAI_API_KEY` | At least one | [OpenAI Platform](https://platform.openai.com/api-keys) API key |
| `PORT` | No | Server port (default: 3000) |

> 🔒 **The `.env` file is gitignored.** Your API keys are never committed.

## What This Is (and Isn't)

**This IS:**
- A visual concept demo of SCION's multi-agent orchestration pattern
- A working example of vendor-agnostic AI agent coordination
- A companion project to explain why SCION matters

**This IS NOT:**
- A SCION deployment (that requires Go, containers, and SCION's runtime)
- A production multi-agent system
- A replacement for SCION's actual isolation guarantees

For the real thing: [github.com/GoogleCloudPlatform/scion](https://github.com/GoogleCloudPlatform/scion)

## License

Apache 2.0 - Same as Google SCION.
