import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { TUI, Theme, Component } from "@mariozechner/pi-tui";

export default function (pi: ExtensionAPI) {
  let active = true;
  const state = {
    mode: "chat" as "chat" | "plan" | "build" | "review",
    activity: "ready" as "ready" | "thinking" | "tool" | "network" | "done",
    tokens: 0,
    turns: 0,
    gitChanges: 0,
    tmuxSessions: 0,
    planSteps: { completed: 0, total: 0 } as { completed: number; total: number },
    toolRunning: false,
    toolName: "",
    toolStart: 0,
  };

  // Create footer component
  function createFooter(): Component & { dispose?(): void } {
    let disposed = false;

    return {
      render: (width: number) => {
        if (disposed || width < 40) return [""];

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

        // Left side: Mode indicator with label
        const left = `${modeInfo} ${state.mode.toUpperCase()}`;
        
        // Activity indicator (only when active) - shown after mode
        let activityPart = "";
        if (activity) {
          activityPart = ` • ${activity}`;
        }
        
        // Show plan progress in plan mode
        let modeExtra = "";
        if (state.mode === "plan" && state.planSteps.total > 0) {
          modeExtra = ` • ${state.planSteps.completed}/${state.planSteps.total} steps`;
        }
        
        // Right side: Stats tray with proper spacing
        const stats = [
          `📊 ${state.tokens.toLocaleString()}`,
          `🔄 ${state.turns}`,
          `📂 ${state.gitChanges}`,
          `🖥️ ${state.tmuxSessions}`,
        ].join("  ");
        
        // Build the full line
        const separator = " │ ";
        const leftFull = `${left}${activityPart}${modeExtra}`;
        
        // Calculate padding for right alignment
        const totalContent = leftFull + separator + stats;
        const padding = Math.max(0, width - totalContent.length - 2);
        
        return [` ${leftFull}${separator}${stats}${" ".repeat(padding)} `];
      },
      
      dispose: () => {
        disposed = true;
      }
    };
  }

  async function updateFooter(ctx: any) {
    if (!active) return;
    
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

    // Update the footer
    if (ctx.ui?.setFooter) {
      ctx.ui.setFooter(createFooter);
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
    state.planSteps = { completed: 0, total: 0 };
    state.activity = "ready";
    updateFooter(ctx);
  });

  pi.on("turn_start", async (_event, ctx) => {
    state.turns++;
    state.activity = "thinking";
    updateFooter(ctx);
  });

  pi.on("message_update", async (_event, ctx) => {
    updateFooter(ctx);
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
    updateFooter(ctx);
    
    // Reset after 2 seconds
    const resetAt = Date.now() + 2000;
    const checkReset = async (_e: any, c: any) => {
      if (active && state.activity === "done" && Date.now() > resetAt) {
        state.activity = "ready";
        updateFooter(c);
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
    const tool = event.toolName;
    
    if (tool.includes("write") || tool.includes("edit") || tool.includes("create")) {
      try {
        await import("node:fs/promises").then(fs => fs.access("PLAN.md"));
        state.mode = "plan";
      } catch {
        state.mode = "build";
      }
    } else if (tool.includes("git") || tool.includes("commit") || tool.includes("diff")) {
      state.mode = "review";
    } else if (tool.includes("search") || tool.includes("browser")) {
      state.mode = "chat";
    }
    updateFooter(_ctx);
  });

  // Listen for mode changes from context
  pi.on("context_update", async (event, ctx) => {
    if (event.mode) {
      state.mode = event.mode;
      updateFooter(ctx);
    }
    if (event.planSteps) {
      state.planSteps = event.planSteps;
      updateFooter(ctx);
    }
  });

  // Listen for plan step updates
  pi.on("plan_step_added", async (event, ctx) => {
    state.planSteps.total++;
    updateFooter(ctx);
  });

  pi.on("plan_step_completed", async (event, ctx) => {
    state.planSteps.completed++;
    updateFooter(ctx);
  });

  function formatToolName(name: string): string {
    return name.split("_").slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
}
