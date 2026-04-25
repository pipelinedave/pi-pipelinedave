import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs/promises";
import * as path from "node:path";

interface PromptEnhancement {
  original: string;
  enhanced: string;
  improvements: string[];
  suggestedCommands: string[];
}

export default function (pi: ExtensionAPI) {
  // Track conversation context
  let lastToolUsed = "";
  let recentFiles: string[] = [];
  let currentContext: {
    isGitRepo: boolean;
    hasUncommittedChanges: boolean;
    activeTmuxSessions: number;
    recentTools: string[];
  } = {
    isGitRepo: false,
    hasUncommittedChanges: false,
    activeTmuxSessions: 0,
    recentTools: [],
  };

  // Update context periodically
  async function updateContext(ctx: any) {
    try {
      const { execSync } = await import("node:child_process");
      
      // Check git
      try {
        execSync("git rev-parse --git-dir", { stdio: "ignore" });
        currentContext.isGitRepo = true;
        const status = execSync("git status --short", { encoding: "utf-8" }).trim();
        currentContext.hasUncommittedChanges = status.length > 0;
      } catch {
        currentContext.isGitRepo = false;
        currentContext.hasUncommittedChanges = false;
      }

      // Check tmux
      try {
        const sessions = execSync("tmux list-sessions 2>/dev/null || echo ''", { encoding: "utf-8" }).trim();
        currentContext.activeTmuxSessions = sessions ? sessions.split("\n").length : 0;
      } catch {
        currentContext.activeTmuxSessions = 0;
      }
    } catch (err) {
      console.error("Context update failed:", err);
    }
  }

  // Enhance user prompts with context
  async function enhancePrompt(text: string, ctx: any): Promise<PromptEnhancement> {
    const improvements: string[] = [];
    const suggestedCommands: string[] = [];
    let enhanced = text;

    // Detect intent and add context
    const lowerText = text.toLowerCase();

    // Plan mode detection
    if (lowerText.includes("plan") || lowerText.includes("step by step") || lowerText.includes("break this down")) {
      if (!lowerText.includes("/plan")) {
        improvements.push("Detected planning intent - suggesting plan mode");
        suggestedCommands.push("/plan start");
        enhanced = `/plan start\n\n${text}`;
      }
    }

    // Code review detection
    if (lowerText.includes("review") || lowerText.includes("check for bugs") || lowerText.includes("look at this code")) {
      improvements.push("Detected code review request");
      suggestedCommands.push("/skill:code-review");
    }

    // Git operations detection
    if (lowerText.includes("commit") || lowerText.includes("stash") || lowerText.includes("branch")) {
      if (currentContext.isGitRepo) {
        improvements.push("Git operations detected - ensuring checkpoint created");
        suggestedCommands.push("/git-checkpoint before changes");
      }
    }

    // Long-running task detection
    if (lowerText.includes("build") || lowerText.includes("run") || lowerText.includes("start server") || lowerText.includes("watch")) {
      if (currentContext.activeTmuxSessions < 3) {
        improvements.push("Long-running task detected - suggesting background execution");
        suggestedCommands.push("/tmux new <session-name> <command>");
      }
    }

    // File operations context
    if (lowerText.includes("read") || lowerText.includes("write") || lowerText.includes("edit")) {
      if (recentFiles.length > 0) {
        const contextFiles = recentFiles.slice(0, 3).join(", ");
        enhanced = `${text}\n\nContext: Recently worked with files: ${contextFiles}`;
        improvements.push("Added file context");
      }
    }

    // Search/web detection
    if (lowerText.includes("search") || lowerText.includes("look up") || lowerText.includes("find information") || lowerText.includes("what is")) {
      if (lowerText.includes("latest") || lowerText.includes("current") || lowerText.includes("2024") || lowerText.includes("2025") || lowerText.includes("2026")) {
        improvements.push("Time-sensitive query detected - using web search");
        suggestedCommands.push("Use brave-search MCP tool");
      }
    }

    // Database detection
    if (lowerText.includes("database") || lowerText.includes("sql") || lowerText.includes("query") || lowerText.includes("table")) {
      improvements.push("Database operations detected");
      suggestedCommands.push("Use sqlite MCP tool");
    }

    // Docker/K8s detection
    if (lowerText.includes("docker") || lowerText.includes("container") || lowerText.includes("pod") || lowerText.includes("deployment")) {
      improvements.push("Container orchestration detected");
      suggestedCommands.push("Use docker/kubernetes MCP tools");
    }

    return {
      original: text,
      enhanced,
      improvements,
      suggestedCommands,
    };
  }

  // Intercept and enhance user input
  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return; // Skip extension-injected messages

    await updateContext(ctx);

    const enhancement = await enhancePrompt(event.text, ctx);

    if (enhancement.improvements.length > 0) {
      // Show subtle notification about enhancements
      if (enhancement.improvements.length <= 2) {
        ctx.ui.notify(`✨ ${enhancement.improvements.join(", ")}`, "info");
      }

      // If we have suggested commands, show them
      if (enhancement.suggestedCommands.length > 0 && enhancement.suggestedCommands.length <= 3) {
        // Don't block, just enhance the prompt
        event.text = enhancement.enhanced;
      }
    }

    // Track recent files mentioned
    const fileMatches = event.text.match(/\/[\w./-]+\.(ts|js|py|rs|go|md|json|yaml|yml)/g);
    if (fileMatches) {
      recentFiles = [...new Set([...recentFiles, ...fileMatches])].slice(-10);
    }

    return { action: "continue" };
  });

  // Track tool usage
  pi.on("tool_execution_end", async (event, _ctx) => {
    lastToolUsed = event.toolName;
    currentContext.recentTools = [...currentContext.recentTools, event.toolName].slice(-10);
  });

  // Smart command suggestions based on context
  pi.on("turn_end", async (event, ctx) => {
    // After certain tool usage, suggest follow-ups
    if (event.toolResults && event.toolResults.length > 0) {
      const lastResult = event.toolResults[event.toolResults.length - 1];
      
      // After file writes, suggest git checkpoint
      if (lastResult.toolName === "write_file" || lastResult.toolName === "filesystem_write_file") {
        if (currentContext.isGitRepo && !currentContext.hasUncommittedChanges) {
          // Suggest creating a checkpoint
          setTimeout(async () => {
            const approved = await ctx.ui.confirm(
              "File Saved",
              "Create git checkpoint before continuing?"
            );
            if (approved) {
              pi.sendUserMessage("/git-checkpoint auto-save", { deliverAs: "followUp" });
            }
          }, 1000);
        }
      }

      // After long commands, suggest tmux for future
      if (lastResult.toolName === "bash" && lastResult.isError === false) {
        // Check if command took long (we'd need timing data)
        // For now, just note it
      }
    }
  });

  // Auto-activate plan mode for complex tasks
  pi.on("before_agent_start", async (event, ctx) => {
    const prompt = event.prompt.toLowerCase();
    
    // Detect complex multi-step tasks
    const complexPatterns = [
      /implement.*from scratch/i,
      /build.*complete/i,
      /create.*full/i,
      /step by step/i,
      /break down/i,
      /multiple steps/i,
    ];

    if (complexPatterns.some(p => p.test(prompt))) {
      // Check if plan mode is already active
      try {
        await fs.access("PLAN.md");
        // Plan mode already active
      } catch {
        // Not active, ask user
        const usePlanMode = await ctx.ui.confirm(
          "Complex Task Detected",
          "This looks like a multi-step task. Enable plan mode to track progress?"
        );
        
        if (usePlanMode) {
          pi.sendUserMessage("/plan start", { deliverAs: "followUp", triggerTurn: true });
        }
      }
    }
  });

  // Smart suggestions widget
  pi.on("agent_end", async (_event, ctx) => {
    // Show relevant suggestions based on context
    const suggestions: string[] = [];

    if (currentContext.hasUncommittedChanges) {
      suggestions.push("💾 /git-checkpoint to save progress");
    }

    if (currentContext.activeTmuxSessions > 0) {
      suggestions.push(`🖥️ ${currentContext.activeTmuxSessions} tmux session(s) running`);
    }

    if (lastToolUsed.includes("write")) {
      suggestions.push("📝 Consider code review before committing");
    }

    if (suggestions.length > 0) {
      ctx.ui.setWidget("smart-suggestions", suggestions.slice(0, 3));
    }
  });

  // Add a command to manually trigger smart analysis
  pi.registerCommand("analyze", {
    description: "Analyze current context and get smart suggestions",
    handler: async (_args, ctx) => {
      await updateContext(ctx);

      let analysis = `## Smart Context Analysis\n\n`;
      
      // Git status
      if (currentContext.isGitRepo) {
        analysis += `**Git**: ${currentContext.hasUncommittedChanges ? "⚠️ Uncommitted changes" : "✓ Clean"}\n`;
      } else {
        analysis += `**Git**: Not a repository\n`;
      }

      // Tmux sessions
      analysis += `**Tmux**: ${currentContext.activeTmuxSessions} active session(s)\n`;

      // Recent tools
      if (currentContext.recentTools.length > 0) {
        const uniqueTools = [...new Set(currentContext.recentTools.slice(-5))];
        analysis += `**Recent Tools**: ${uniqueTools.join(", ")}\n`;
      }

      // Smart suggestions
      analysis += `\n### Smart Suggestions\n\n`;
      
      if (currentContext.hasUncommittedChanges) {
        analysis += `1. 💾 Create checkpoint: \`/git-checkpoint\`\n`;
      }
      
      if (currentContext.activeTmuxSessions === 0) {
        analysis += `2. 🖥️ Start background task: \`/tmux new <name> <command>\`\n`;
      }

      analysis += `3. 📋 Use plan mode for complex tasks: \`/plan start\`\n`;
      analysis += `4. 🔍 Search web for current info: "Search for [topic]"\n`;

      ctx.ui.notify(analysis, "info");
    },
  });

  // Auto-enhancement settings
  let autoEnhanceEnabled = true;

  pi.registerCommand("copilot", {
    description: "Configure smart copilot features",
    handler: async (args, ctx) => {
      const [cmd] = args?.split(" ") || [];

      switch (cmd) {
        case "off":
          autoEnhanceEnabled = false;
          ctx.ui.notify("Smart copilot: OFF", "info");
          break;
        case "on":
          autoEnhanceEnabled = true;
          ctx.ui.notify("Smart copilot: ON", "success");
          break;
        case "status":
          ctx.ui.notify(`Smart copilot: ${autoEnhanceEnabled ? "ON" : "OFF"}`, "info");
          break;
        default:
          ctx.ui.notify(
            "Smart Copilot Commands:\n" +
              "  /copilot on - Enable auto-enhancement\n" +
              "  /copilot off - Disable auto-enhancement\n" +
              "  /copilot status - Show status\n" +
              "  /analyze - Manual context analysis",
            "info"
          );
      }
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    await updateContext(ctx);
    ctx.ui.notify("✨ Smart Copilot active - prompts will be enhanced automatically", "success");
  });
}
