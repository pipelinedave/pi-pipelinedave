import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let active = true;
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
    if (!active || !ctx.ui?.setWidget) return;

    try {
      // Get fresh data
      const usage = ctx.getContextUsage?.();
      if (usage?.tokens) state.tokens = usage.tokens;
      
      // Git status
      try {
        const { execSync } = await import("node:child_process");
        const status = execSync("git status --short 2>/dev/null || echo ''", { encoding: "utf-8" }).trim();
        state.gitChanges = status ? status.split("\n").filter(l => l.trim()).length : 0;
      } catch {}

      // Tmux sessions
      try {
        const { execSync } = await import("node:child_process");
        const sessions = execSync("tmux list-sessions 2>/dev/null || echo ''", { encoding: "utf-8" }).trim();
        state.tmuxSessions = sessions ? sessions.split("\n").length : 0;
      } catch {}

      // Mode indicator with emoji
      const modeInfo = {
        chat: "💬",
        plan: "📋",
        build: "🔨",
        review: "👀",
      }[state.mode];

      // Activity indicator (only when active)
      let activity = "";
      if (state.activity === "tool" && state.toolRunning) {
        const duration = Math.round((Date.now() - state.toolStart) / 1000);
        activity = `🔧 ${formatToolName(state.toolName)} ${duration}s`;
      } else if (state.activity === "thinking") {
        activity = "⚡";
      } else if (state.activity === "network") {
        activity = "🌐";
      }

      // Fixed width for consistent alignment
      const minWidth = 70;
      
      // Left side: Mode + Activity
      const left = activity ? `${modeInfo} ${activity}` : modeInfo;
      
      // Right side: Stats tray (symbol LEFT of value, aligned right)
      const right = `📊${state.tokens.toLocaleString()} 🔄${state.turns} 📂${state.gitChanges} 🖥️${state.tmuxSessions}`;
      
      // Calculate padding to fill the box
      const content = `${left}  │  ${right}`;
      const width = Math.max(content.length + 4, minWidth);
      const padding = width - content.length - 2;
      
      const boxTop = "╭" + "─".repeat(width - 2) + "╮";
      const boxMiddle = `│ ${left}  │  ${right}${" ".repeat(padding)} │`;
      const boxBottom = "╰" + "─".repeat(width - 2) + "╯";
      
      ctx.ui.setWidget("status", [boxTop, boxMiddle, boxBottom]);
    } catch (e) {
      // Silently fail if context is stale
    }
  }

  // Mark as inactive on shutdown
  pi.on("session_shutdown", () => {
    active = false;
  });

  pi.on("session_start", async (_event, ctx) => {
    active = true;
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

  pi.on("tool_execution_end", async (_event, ctx) => {
    state.toolRunning = false;
    state.toolName = "";
    state.activity = "done";
    updateStatus(ctx);
    
    // Reset after 2 seconds
    const resetAt = Date.now() + 2000;
    const checkReset = async (_e: any, c: any) => {
      if (active && state.activity === "done" && Date.now() > resetAt) {
        state.activity = "ready";
        updateStatus(c);
        pi.off("turn_start", checkReset);
      }
    };
    pi.on("turn_start", checkReset);
  });

  pi.on("before_provider_request", async () => {
    state.activity = "network";
  });

  pi.on("after_provider_response", async () => {
    state.activity = "thinking";
  });

  // Mode detection - improved
  pi.on("tool_call", async (event, _ctx) => {
    // Detect mode based on tools being used
    const tool = event.toolName;
    
    if (tool.includes("write") || tool.includes("edit") || tool.includes("create")) {
      // Check for PLAN.md to distinguish plan vs build
      try {
        await import("node:fs/promises").then(fs => fs.access("PLAN.md"));
        state.mode = "plan";
      } catch {
        state.mode = "build";
      }
    } else if (tool.includes("git") || tool.includes("commit") || tool.includes("diff")) {
      state.mode = "review";
    } else if (tool.includes("search") || tool.includes("browser")) {
      state.mode = "chat"; // Research mode stays in chat
    }
    updateStatus(_ctx);
  });

  // Listen for mode changes from context
  pi.on("context_update", async (event, ctx) => {
    if (event.mode) {
      state.mode = event.mode;
      updateStatus(ctx);
    }
  });

  function formatToolName(name: string): string {
    return name.split("_").slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
}
