import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  const state = {
    mode: "chat" as "chat" | "plan" | "build" | "review",
    activity: "ready",
    tokens: 0,
    turns: 0,
    gitChanges: 0,
    tmuxSessions: 0,
    toolRunning: false,
    toolName: "",
    toolDuration: 0,
  };

  // Compact single-line status bar with box drawing
  function renderStatusBar(ctx: any) {
    if (!ctx.ui?.setWidget) return;

    // Mode emoji and color
    const modeInfo = {
      chat: { emoji: "💬", name: "CHAT" },
      plan: { emoji: "📋", name: "PLAN" },
      build: { emoji: "🔨", name: "BUILD" },
      review: { emoji: "👀", name: "REVIEW" },
    }[state.mode];

    // Activity indicator
    const activityInfo = {
      ready: { emoji: "✓", text: "" },
      thinking: { emoji: "⚡", text: "thinking" },
      tool: { emoji: "🔧", text: state.toolName ? formatToolName(state.toolName) : "tool" },
      network: { emoji: "🌐", text: "api" },
      done: { emoji: "✓", text: "" },
    }[state.activity];

    // Build compact status line
    const modeStr = `${modeInfo.emoji} ${modeInfo.name}`;
    const activityStr = state.activity === "tool" && state.toolRunning
      ? `${activityInfo.emoji} ${activityInfo.text} ${Math.round(state.toolDuration / 1000)}s`
      : state.activity !== "ready"
      ? `${activityInfo.emoji} ${activityInfo.text}`
      : "";
    
    const statsStr = `${state.tokens.toLocaleString()}📊 ${state.turns}🔄 ${state.gitChanges}📂 ${state.tmuxSessions}🖥️`;

    // Single compact line with visual separators
    const parts = [modeStr];
    if (activityStr) parts.push(activityStr);
    parts.push(statsStr);

    const statusLine = parts.join(" │ ");

    // Create styled widget with minimal vertical space
    ctx.ui.setWidget("sleek-status", [
      `╭────────────────────────────────────────────────────────╮`,
      `│ ${statusLine.padEnd(56)} │`,
      `╰────────────────────────────────────────────────────────╯`,
    ]);
  }

  // Even more compact version (1 line)
  function renderCompactStatus(ctx: any) {
    if (!ctx.ui?.setWidget) return;

    const modeInfo = {
      chat: "💬",
      plan: "📋",
      build: "🔨",
      review: "👀",
    }[state.mode];

    const activityEmoji = {
      ready: "",
      thinking: "⚡",
      tool: "🔧",
      network: "🌐",
      done: "✓",
    }[state.activity];

    const activityPart = state.activity === "tool" && state.toolRunning
      ? `🔧 ${formatToolName(state.toolName)}(${Math.round(state.toolDuration / 1000)}s)`
      : state.activity !== "ready"
      ? activityEmoji
      : "";

    // Ultra compact: [MODE] [ACTIVITY] [TOKENS] [TURNS] [FILES] [TMUX]
    const line = `${modeInfo}|${activityPart}|${state.tokens.toLocaleString()}📊|${state.turns}🔄|${state.gitChanges}📂|${state.tmuxSessions}🖥️`;

    ctx.ui.setWidget("compact-status", [line]);
  }

  // Event handlers
  pi.on("session_start", async (_event, ctx) => {
    state.mode = "chat";
    state.turns = 0;
    state.tokens = 0;
    state.activity = "ready";
    
    renderCompactStatus(ctx);
  });

  pi.on("turn_start", async (_event, ctx) => {
    state.turns++;
    state.activity = "thinking";
    
    const usage = ctx.getContextUsage?.();
    if (usage?.tokens) state.tokens = usage.tokens;
    
    renderCompactStatus(ctx);
  });

  pi.on("message_update", async (_event, ctx) => {
    const usage = ctx.getContextUsage?.();
    if (usage?.tokens) state.tokens = usage.tokens;
    renderCompactStatus(ctx);
  });

  pi.on("tool_execution_start", async (event, _ctx) => {
    state.toolRunning = true;
    state.toolName = event.toolName;
    state.toolDuration = 0;
    state.activity = "tool";
  });

  pi.on("tool_execution_update", async (event, _ctx) => {
    state.toolDuration = Date.now() - (event.details?.startTime || Date.now());
  });

  pi.on("tool_execution_end", async (event, _ctx) => {
    state.toolRunning = false;
    state.toolName = "";
    state.toolDuration = 0;
    state.activity = "done";
    
    setTimeout(() => {
      state.activity = "ready";
      renderCompactStatus(_ctx);
    }, 2000);
  });

  pi.on("before_provider_request", async () => {
    state.activity = "network";
  });

  pi.on("after_provider_response", async () => {
    state.activity = "thinking";
  });

  pi.on("agent_end", async (_event, ctx) => {
    state.activity = "done";
    setTimeout(() => {
      state.activity = "ready";
      renderCompactStatus(ctx);
    }, 2000);
  });

  // Listen for mode changes
  pi.on("tool_call", async (event, _ctx) => {
    if (event.toolName.includes("write") || event.toolName.includes("edit")) {
      try {
        await import("node:fs/promises").then(fs => fs.access("PLAN.md"));
        state.mode = "plan";
      } catch {
        state.mode = "build";
      }
    }
  });

  // Periodic git/tmux updates
  setInterval(async () => {
    // Will update on next widget render
  }, 5000);

  function formatToolName(name: string): string {
    return name.split("_").slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
}
