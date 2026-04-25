/**
 * Cyberpunk Status Bar - The Ultimate Pi.dev Status Indicator
 * 
 * Features:
 * - Real-time mode detection (chat/plan/build/review)
 * - Live token counter with cost tracking
 * - Tool execution timer with name display
 * - Git branch & changes tracking
 * - Tmux session counter
 * - Network activity indicator
 * - Animated cyberpunk box with gradients
 * - Responsive width handling
 * - Theme-aware colors
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { matchesKey, Key, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

interface StatusState {
  mode: "chat" | "plan" | "build" | "review";
  activity: "ready" | "thinking" | "tool" | "network" | "done" | "error";
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  turns: number;
  gitBranch: string | null;
  gitChanges: number;
  tmuxSessions: number;
  toolRunning: boolean;
  toolName: string;
  toolStart: number;
  isFocused: boolean;
  animationFrame: number;
}

// Cyberpunk animation frames for loading effect
const ANIMATION_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// Mode configurations
const MODE_CONFIG = {
  chat: { emoji: "💬", label: "CHAT", color: "cyan" },
  plan: { emoji: "📋", label: "PLAN", color: "magenta" },
  build: { emoji: "🔨", label: "BUILD", color: "green" },
  review: { emoji: "👀", label: "REVIEW", color: "yellow" },
};

export default function (pi: ExtensionAPI) {
  const state: StatusState = {
    mode: "chat",
    activity: "ready",
    tokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
    turns: 0,
    gitBranch: null,
    gitChanges: 0,
    tmuxSessions: 0,
    toolRunning: false,
    toolName: "",
    toolStart: 0,
    isFocused: true,
    animationFrame: 0,
  };

  let updateInterval: NodeJS.Timeout | null = null;
  let animationInterval: NodeJS.Timeout | null = null;

  // Helper: Format numbers with K/M suffixes
  function formatNumber(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return `${n}`;
  }

  // Helper: Format duration
  function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m${secs}s`;
  }

  // Helper: Format tool name
  function formatToolName(name: string): string {
    return name
      .split("_")
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  // Get git status
  async function getGitStatus(): Promise<{ branch: string | null; changes: number }> {
    try {
      const { execSync } = await import("node:child_process");
      const branch = execSync("git rev-parse --abbrev-ref HEAD 2>/dev/null", { encoding: "utf-8" }).trim() || null;
      const status = execSync("git status --short 2>/dev/null || echo ''", { encoding: "utf-8" }).trim();
      const changes = status ? status.split("\n").filter((l) => l.trim()).length : 0;
      return { branch, changes };
    } catch {
      return { branch: null, changes: 0 };
    }
  }

  // Get tmux session count
  async function getTmuxCount(): Promise<number> {
    try {
      const { execSync } = await import("node:child_process");
      const sessions = execSync("tmux list-sessions 2>/dev/null || echo ''", { encoding: "utf-8" }).trim();
      return sessions ? sessions.split("\n").length : 0;
    } catch {
      return 0;
    }
  }

  // Calculate token usage from session
  function calculateTokens(ctx: any): { input: number; output: number; total: number; cost: number } {
    let input = 0,
      output = 0,
      cost = 0;

    try {
      const entries = ctx.sessionManager?.getBranch?.() || [];
      for (const entry of entries) {
        if (entry.type === "message" && entry.message?.role === "assistant") {
          const usage = entry.message.usage || {};
          input += usage.input || 0;
          output += usage.output || 0;
          cost += usage.cost?.total || 0;
        }
      }
    } catch {
      // Silent fail
    }

    return { input, output, total: input + output, cost };
  }

  // Render the status bar
  function renderStatus(width: number, theme: any): string[] {
    const config = MODE_CONFIG[state.mode];
    
    // Animation frame for loading effect
    const anim = state.activity === "thinking" || state.activity === "network" 
      ? ANIMATION_FRAMES[state.animationFrame % ANIMATION_FRAMES.length] 
      : "●";

    // Activity indicator
    let activityStr = "";
    if (state.activity === "tool" && state.toolRunning) {
      const duration = Date.now() - state.toolStart;
      activityStr = `${theme.fg("yellow", "⚙")} ${theme.fg("dim", formatToolName(state.toolName))} ${theme.fg("cyan", `(${formatDuration(duration)})`)}`;
    } else if (state.activity === "thinking") {
      activityStr = `${theme.fg("cyan", anim)} ${theme.fg("dim", "thinking")}`;
    } else if (state.activity === "network") {
      activityStr = `${theme.fg("magenta", "🌐")} ${theme.fg("dim", "api")}`;
    } else if (state.activity === "done") {
      activityStr = theme.fg("green", "✓");
    }

    // Mode indicator
    const modeColor = config.color as keyof typeof theme;
    const modeStr = `${theme.fg(modeColor, config.emoji)} ${theme.fg(modeColor, theme.bold(config.label))}`;

    // Stats section
    const tokenStr = theme.fg("yellow", `${formatNumber(state.tokens)}📊`);
    const turnStr = theme.fg("magenta", `${state.turns}🔄`);
    const gitStr = state.gitChanges > 0 
      ? theme.fg("red", `${state.gitChanges}📂`) 
      : theme.fg("dim", "0📂");
    const tmuxStr = state.tmuxSessions > 0 
      ? theme.fg("cyan", `${state.tmuxSessions}🖥️`) 
      : theme.fg("dim", "0🖥️");

    // Branch indicator
    const branchStr = state.gitBranch 
      ? theme.fg("dim", ` (${theme.fg("green", state.gitBranch)})`) 
      : "";

    // Build the status line
    const stats = `${tokenStr} ${turnStr} ${gitStr} ${tmuxStr}`;
    const middle = activityStr ? ` ${activityStr} ` : "";
    
    const leftPart = `${modeStr}${branchStr}`;
    const rightPart = stats;
    
    // Calculate padding
    const leftWidth = visibleWidth(leftPart);
    const rightWidth = visibleWidth(rightPart);
    const middleWidth = width - leftWidth - rightWidth - 4; // 4 for borders and spacing
    
    const paddedMiddle = middle 
      ? middle.padEnd(Math.max(1, middleWidth))
      : " ".repeat(Math.max(1, middleWidth));

    const statusLine = `${leftPart}${paddedMiddle}${rightPart}`;
    const truncatedLine = truncateToWidth(statusLine, width - 4);

    // Box dimensions
    const boxWidth = Math.max(truncatedLine.length + 4, 40);
    const boxLine = "─".repeat(boxWidth);

    // Cyberpunk gradient effect using different colors
    const topBorder = theme.fg("magenta", "╭") + theme.fg("cyan", boxLine) + theme.fg("magenta", "╮");
    const bottomBorder = theme.fg("magenta", "╰") + theme.fg("cyan", boxLine) + theme.fg("magenta", "╯");
    const contentLine = `${theme.fg("magenta", "│")} ${truncatedLine} ${theme.fg("magenta", "│")}`;

    return [topBorder, contentLine, bottomBorder];
  }

  // Animation frame updater
  function startAnimation() {
    if (animationInterval) return;
    animationInterval = setInterval(() => {
      state.animationFrame++;
      if (updateInterval) {
        // Trigger re-render through interval
      }
    }, 100);
  }

  function stopAnimation() {
    if (animationInterval) {
      clearInterval(animationInterval);
      animationInterval = null;
    }
  }

  // Main update function
  async function updateStatus(ctx: any) {
    if (!ctx.ui?.setWidget) return;

    try {
      // Get fresh data
      const tokenData = calculateTokens(ctx);
      state.inputTokens = tokenData.input;
      state.outputTokens = tokenData.output;
      state.tokens = tokenData.total;
      state.cost = tokenData.cost;

      // Git status
      const gitStatus = await getGitStatus();
      state.gitBranch = gitStatus.branch;
      state.gitChanges = gitStatus.changes;

      // Tmux sessions
      state.tmuxSessions = await getTmuxCount();

      // Render and update widget
      const widgetLines = renderStatus(80, ctx.ui.theme); // Will be resized by TUI
      ctx.ui.setWidget("cyberpunk-status", widgetLines);
    } catch (e) {
      // Silent fail if context is stale
    }
  }

  // Event handlers
  pi.on("session_start", async (_event, ctx) => {
    state.mode = "chat";
    state.turns = 0;
    state.tokens = 0;
    state.cost = 0;
    state.activity = "ready";
    state.toolRunning = false;
    
    startAnimation();
    await updateStatus(ctx);

    // Periodic updates
    updateInterval = setInterval(async () => {
      await updateStatus(ctx);
    }, 2000);
  });

  pi.on("session_shutdown", () => {
    state.isFocused = false;
    stopAnimation();
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
  });

  pi.on("turn_start", async (_event, ctx) => {
    state.turns++;
    state.activity = "thinking";
    await updateStatus(ctx);
  });

  pi.on("turn_end", async (_event, ctx) => {
    state.activity = "done";
    await updateStatus(ctx);
    
    // Reset after 3 seconds
    setTimeout(async () => {
      if (state.activity === "done") {
        state.activity = "ready";
        await updateStatus(ctx);
      }
    }, 3000);
  });

  pi.on("message_update", async (_event, ctx) => {
    await updateStatus(ctx);
  });

  pi.on("tool_execution_start", async (event: any, _ctx: any) => {
    state.toolRunning = true;
    state.toolName = event.toolName || "unknown";
    state.toolStart = Date.now();
    state.activity = "tool";
  });

  pi.on("tool_execution_end", async (_event: any, ctx: any) => {
    state.toolRunning = false;
    state.toolName = "";
    state.activity = "done";
    await updateStatus(ctx);
  });

  pi.on("before_provider_request", async () => {
    state.activity = "network";
  });

  pi.on("after_provider_response", async () => {
    state.activity = "thinking";
  });

  // Mode detection based on tool calls and files
  pi.on("tool_call", async (event: any, _ctx: any) => {
    const toolName = event.toolName || "";
    
    // Detect plan mode
    if (toolName.includes("read") || toolName.includes("search")) {
      try {
        const { access } = await import("node:fs/promises");
        await access("PLAN.md");
        state.mode = "plan";
      } catch {
        // Not in plan mode
      }
    }
    
    // Detect build mode
    if (toolName.includes("write") || toolName.includes("edit")) {
      state.mode = "build";
    }
    
    // Detect review mode
    if (toolName.includes("review") || toolName.includes("lint")) {
      state.mode = "review";
    }
  });

  // Cleanup on extension unload
  return () => {
    stopAnimation();
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  };
}
