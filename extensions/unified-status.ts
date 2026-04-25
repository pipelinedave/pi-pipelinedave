import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  const state = {
    mode: "chat" as "chat" | "plan" | "build" | "review",
    activity: "ready" as "ready" | "thinking" | "tool" | "network" | "done",
    tokens: 0,
    turns: 0,
    gitChanges: 0,
    tmuxSessions: 0,
    toolRunning: false,
    toolName: "",
    toolStart: 0,
  };

  async function updateStatus(ctx: any) {
    if (!ctx.ui?.setWidget) return;

    // Get fresh data
    const usage = ctx.getContextUsage?.();
    if (usage?.tokens) state.tokens = usage.tokens;
    
    const model = ctx.model;
    const modelName = model ? `${model.provider}/${model.id}`.split('/').pop() : 'Pi';

    // Git status
    try {
      const { execSync } = await import("node:child_process");
      const status = execSync("git status --short 2>/dev/null || echo ''", { encoding: "utf-8" }).trim();
      state.gitChanges = status ? status.split("\n").filter(l => l.trim()).length : 0;
    } catch {
      state.gitChanges = 0;
    }

    // Tmux sessions
    try {
      const { execSync } = await import("node:child_process");
      const sessions = execSync("tmux list-sessions 2>/dev/null || echo ''", { encoding: "utf-8" }).trim();
      state.tmuxSessions = sessions ? sessions.split("\n").length : 0;
    } catch {
      state.tmuxSessions = 0;
    }

    // Mode indicator
    const modeMap: Record<string, { emoji: string; color: string }> = {
      chat: { emoji: "💬", color: "blue" },
      plan: { emoji: "📋", color: "green" },
      build: { emoji: "🔨", color: "yellow" },
      review: { emoji: "👀", color: "purple" },
    };
    const mode = modeMap[state.mode];

    // Activity indicator
    let activity = "";
    if (state.activity === "tool" && state.toolRunning) {
      const duration = Math.round((Date.now() - state.toolStart) / 1000);
      activity = `🔧 ${formatToolName(state.toolName)} (${duration}s)`;
    } else if (state.activity === "thinking") {
      activity = "⚡ thinking";
    } else if (state.activity === "network") {
      activity = "🌐 api";
    } else if (state.activity === "done") {
      activity = "✓";
    }

    // Build status line
    const left = `${mode.emoji} ${state.mode.toUpperCase()}`;
    const middle = activity || "";
    const right = `${state.tokens.toLocaleString()}📊 ${state.turns}🔄 ${state.gitChanges}📂 ${state.tmuxSessions}🖥️`;

    // Compact single line with separators
    const parts = [left];
    if (middle) parts.push(middle);
    parts.push(right);
    
    const statusLine = parts.join(" │ ");

    // Render with box drawing (2 lines)
    const width = Math.max(statusLine.length + 4, 60);
    const boxLine = "─".repeat(width);
    
    ctx.ui.setWidget("status", [
      `╭${boxLine}╮`,
      `│ ${statusLine.padEnd(width - 2)} │`,
      `╰${boxLine}╯`,
    ]);
  }

  // Event handlers
  pi.on("session_start", async (_event, ctx) => {
    state.mode = "chat";
    state.turns = 0;
    state.tokens = 0;
    state.activity = "ready";
    updateStatus(ctx);
  });

  pi.on("turn_start", async (_event, ctx) => {
    state.turns++;
    state.activity = "thinking";
    updateStatus(ctx);
  });

  pi.on("message_update", async (_event, ctx) => {
    updateStatus(ctx);
  });

  pi.on("tool_execution_start", async (event, _ctx) => {
    state.toolRunning = true;
    state.toolName = event.toolName;
    state.toolStart = Date.now();
    state.activity = "tool";
  });

  pi.on("tool_execution_update", async (_event, _ctx) => {
    // Duration updates handled in render
  });

  pi.on("tool_execution_end", async (_event, _ctx) => {
    state.toolRunning = false;
    state.toolName = "";
    state.activity = "done";
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
      updateStatus(ctx);
    }, 2000);
  });

  // Mode detection
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

  // Periodic refresh
  setInterval(() => {
    // Will be called on next event
  }, 10000);

  function formatToolName(name: string): string {
    return name.split("_").slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
}
