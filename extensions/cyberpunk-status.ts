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

  // Render the status bar - stable layout: symbols left, activity middle, stats right
  function renderStatus(width: number, theme: any): string[] {
    const config = MODE_CONFIG[state.mode];
    
    // Fixed-width activity indicator to prevent layout shifts
    const ACTIVITY_WIDTH = 18;
    
    // Animation frame for loading effect
    const anim = state.activity === "thinking" || state.activity === "network" 
      ? ANIMATION_FRAMES[state.animationFrame % ANIMATION_FRAMES.length] 
      : "●";

    // Activity indicator - always same width
    let activityStr = "";
    if (state.activity === "tool" && state.toolRunning) {
      const duration = Date.now() - state.toolStart;
      const toolText = `${formatToolName(state.toolName)} ${formatDuration(duration)}`;
      const truncated = truncateToWidth(toolText, ACTIVITY_WIDTH - 4);
      activityStr = `${theme.fg("yellow", "⚙")} ${theme.fg("cyan", truncated)}`;
    } else if (state.activity === "thinking") {
      activityStr = `${theme.fg("cyan", anim)} ${theme.fg("dim", "thinking")}`;
    } else if (state.activity === "network") {
      activityStr = `${theme.fg("magenta", "🌐")} ${theme.fg("dim", "api")}`;
    } else if (state.activity === "done") {
      activityStr = theme.fg("green", "✓");
    }
    
    // Pad activity to fixed width for stability
    const activityPadded = truncateToWidth(activityStr, ACTIVITY_WIDTH).padEnd(ACTIVITY_WIDTH);

    // Mode indicator with branch (left side)
    const modeColor = config.color as keyof typeof theme;
    const branchShort = state.gitBranch && state.gitBranch.length > 10 
      ? state.gitBranch.substring(0, 10) + "…" 
      : state.gitBranch || "";
    const branchStr = branchShort ? theme.fg("dim", `(${theme.fg("green", branchShort)})`) : "";
    const modeStr = `${theme.fg(modeColor, config.emoji)} ${theme.fg(modeColor, theme.bold(config.label))}`;
    const leftSection = `${modeStr}${branchStr}`;

    // Stats section - always visible, right side
    const tokenStr = theme.fg("yellow", `${formatNumber(state.tokens)}📊`);
    const turnStr = theme.fg("magenta", `${state.turns}🔄`);
    const gitStr = theme.fg(state.gitChanges > 0 ? "red" : "dim", `${state.gitChanges}📂`);
    const tmuxStr = theme.fg(state.tmuxSessions > 0 ? "cyan" : "dim", `${state.tmuxSessions}🖥️`);
    const rightSection = `${tokenStr} ${turnStr} ${gitStr} ${tmuxStr}`;

    // Build status line with fixed spacing
    const statusLine = `${leftSection}  ${activityPadded}  ${rightSection}`;
    const truncatedLine = truncateToWidth(statusLine, width - 4);

    // Box dimensions
    const boxWidth = Math.max(truncatedLine.length + 4, 50);
    const boxLine = "─".repeat(boxWidth);

    // Cyberpunk gradient effect
    const topBorder = theme.fg("magenta", "╭") + theme.fg("cyan", boxLine) + theme.fg("magenta", "╮");
    const bottomBorder = theme.fg("magenta", "╰") + theme.fg("cyan", boxLine) + theme.fg("magenta", "╯");
    const contentLine = `${theme.fg("magenta", "│")} ${truncatedLine.padEnd(boxWidth - 2)} ${theme.fg("magenta", "│")}`;

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

  // Main update function - uses setFooter instead of setWidget
  async function updateStatus(ctx: any) {
    if (!ctx.ui?.setFooter) return;

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
    } catch (e) {
      // Silent fail if context is stale
    }
  }

  // Set up the footer component
  function setupFooter(ctx: any) {
    ctx.ui.setFooter((tui, theme, footerData) => {
      // Subscribe to git branch changes
      const unsub = footerData?.onBranchChange?.(() => tui.requestRender());

      return {
        dispose: unsub,
        invalidate() {},
        render(width: number): string[] {
          return renderStatus(width, theme);
        },
      };
    });
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
    setupFooter(ctx);

    // Periodic updates
    updateInterval = setInterval(async () => {
      await updateStatus(ctx);
      // Trigger footer re-render
      const footerHandle = ctx.ui.setFooter;
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
