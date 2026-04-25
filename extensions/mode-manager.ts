import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs/promises";

interface ModeState {
  current: "chat" | "plan" | "build" | "review";
  planFile?: string;
  planSteps?: Array<{ description: string; status: string }>;
  restrictions: {
    allowWrites: boolean;
    allowDestructive: boolean;
    allowBash: boolean;
    requireConfirmation: boolean;
  };
}

const modeState: ModeState = {
  current: "chat",
  restrictions: {
    allowWrites: true,
    allowDestructive: true,
    allowBash: true,
    requireConfirmation: false,
  },
};

export default function (pi: ExtensionAPI) {
  // Update mode restrictions
  function updateModeRestrictions() {
    switch (modeState.current) {
      case "chat":
        modeState.restrictions = {
          allowWrites: true,
          allowDestructive: true,
          allowBash: true,
          requireConfirmation: false,
        };
        break;
      case "plan":
        modeState.restrictions = {
          allowWrites: false,
          allowDestructive: false,
          allowBash: false,
          requireConfirmation: true,
        };
        break;
      case "build":
        modeState.restrictions = {
          allowWrites: true,
          allowDestructive: false,
          allowBash: true,
          requireConfirmation: true,
        };
        break;
      case "review":
        modeState.restrictions = {
          allowWrites: false,
          allowDestructive: false,
          allowBash: false,
          requireConfirmation: false,
        };
        break;
    }
  }

  // Check if tool is allowed in current mode
  function isToolAllowed(toolName: string): boolean {
    const isWriteTool = ["write", "edit", "create"].some(k => toolName.includes(k));
    const isDestructiveTool = ["delete", "remove", "rm", "kill"].some(k => toolName.includes(k));
    const isBashTool = toolName.includes("bash") || toolName.includes("exec");

    if (isWriteTool && !modeState.restrictions.allowWrites) return false;
    if (isDestructiveTool && !modeState.restrictions.allowDestructive) return false;
    if (isBashTool && !modeState.restrictions.allowBash) return false;

    return true;
  }

  // Mode switching commands
  pi.registerCommand("mode", {
    description: "Switch between chat/plan/build/review modes",
    handler: async (args, ctx) => {
      const [newMode] = args?.split(" ") || [];

      if (!newMode) {
        // Show current mode
        const modeInfo = getModeInfo();
        ctx.ui.notify(modeInfo, "info");
        return;
      }

      const validModes = ["chat", "plan", "build", "review"];
      if (!validModes.includes(newMode)) {
        ctx.ui.notify(
          `Invalid mode. Use: ${validModes.join(", ")}`,
          "error"
        );
        return;
      }

      // Switch mode
      const oldMode = modeState.current;
      modeState.current = newMode as any;
      updateModeRestrictions();

      // Emit mode change event for status bar
      pi.emit("context_update", {
        mode: newMode,
        planSteps: modeState.planSteps || { completed: 0, total: 0 },
      });

      // Handle mode-specific setup
      if (newMode === "plan") {
        // Check for PLAN.md
        try {
          await fs.access("PLAN.md");
          const content = await fs.readFile("PLAN.md", "utf-8");
          modeState.planFile = "PLAN.md";
          // Parse steps from plan file
          const steps = content.match(/### \d+\..+/g) || [];
          modeState.planSteps = steps.map(s => ({
            description: s.replace(/### \d+\.\s*/, ""),
            status: "pending",
          }));
        } catch {
          // No plan file, will create one
          modeState.planFile = "PLAN.md";
          modeState.planSteps = [];
        }
      }

      ctx.ui.notify(
        `🔄 Switched from ${oldMode.toUpperCase()} to ${newMode.toUpperCase()} mode\n\n${getModeInfo()}`,
        "success"
      );
    },
  });

  // Create mode-specific commands
  pi.registerCommand("plan", {
    description: "Quick access to plan mode",
    handler: async (args, ctx) => {
      const [subcmd] = args?.split(" ") || [];

      if (subcmd === "start" || !subcmd) {
        modeState.current = "plan";
        updateModeRestrictions();
        
        if (!modeState.planFile) {
          modeState.planFile = "PLAN.md";
          modeState.planSteps = [];
        }

        // Emit mode change event
        pi.emit("context_update", {
          mode: "plan",
          planSteps: { completed: 0, total: 0 },
        });

        ctx.ui.notify(
          "📋 Plan Mode Activated\n\n" +
          "• Tool restrictions enabled (no writes/deletes)\n" +
          "• Use /plan add <step> to add steps\n" +
          "• Use /plan done to mark steps complete\n" +
          "• Use /mode chat to exit plan mode",
          "success"
        );
      } else if (subcmd === "add") {
        const step = args?.replace("add ", "") || "";
        if (!step) {
          ctx.ui.notify("Usage: /plan add <step description>", "error");
          return;
        }
        modeState.planSteps?.push({
          description: step,
          status: "pending",
        });
        
        // Emit event for status bar update
        pi.emit("plan_step_added", { step });
        
        ctx.ui.notify(`✓ Added step: ${step}`, "success");
      } else if (subcmd === "done") {
        const pending = modeState.planSteps?.find(s => s.status === "pending");
        if (pending) {
          pending.status = "completed";
          
          // Emit event for status bar update
          pi.emit("plan_step_completed", { step: pending.description });
          
          ctx.ui.notify(`✓ Marked complete: ${pending.description}`, "success");
        } else {
          ctx.ui.notify("No pending steps", "info");
        }
      } else if (subcmd === "status") {
        const steps = modeState.planSteps || [];
        const completed = steps.filter(s => s.status === "completed").length;
        const total = steps.length;
        
        let msg = `## Plan Status\n\n`;
        msg += `**Progress**: ${completed}/${total} steps\n\n`;
        
        steps.forEach((step, i) => {
          const icon = step.status === "completed" ? "✅" : "⏳";
          msg += `${icon} ${i + 1}. ${step.description}\n`;
        });

        ctx.ui.notify(msg, "info");
      } else {
        ctx.ui.notify(
          "Plan Mode Commands:\n" +
          "  /plan start - Enter plan mode\n" +
          "  /plan add <step> - Add step\n" +
          "  /plan done - Mark step complete\n" +
          "  /plan status - Show progress",
          "info"
        );
      }
    },
  });

  // Guard tool calls based on mode
  pi.on("tool_call", async (event, ctx) => {
    if (!isToolAllowed(event.toolName)) {
      if (modeState.restrictions.requireConfirmation) {
        const approved = await ctx.ui.confirm(
          `${modeState.current.toUpperCase()} MODE`,
          `${formatToolName(event.toolName)} is restricted in ${modeState.current} mode. Allow anyway?`
        );
        
        if (!approved) {
          return { block: true, reason: `Tool blocked in ${modeState.current} mode` };
        }
      } else {
        return { 
          block: true, 
          reason: `${formatToolName(event.toolName)} not allowed in ${modeState.current} mode` 
        };
      }
    }
  });

  // Update activity tracker with mode info
  pi.on("session_start", async (_event, ctx) => {
    modeState.current = "chat";
    updateModeRestrictions();
    // Mode display is now handled by status-bar extension
  });

  // Periodic mode status update - removed, handled by status-bar

  function getModeInfo(): string {
    const emoji = getModeEmoji(modeState.current);
    let info = `**${emoji} ${modeState.current.toUpperCase()} MODE**\n\n`;
    
    info += "Restrictions:\n";
    info += `• Write operations: ${modeState.restrictions.allowWrites ? "✅ Allowed" : "❌ Blocked"}\n`;
    info += `• Destructive ops: ${modeState.restrictions.allowDestructive ? "✅ Allowed" : "❌ Blocked"}\n`;
    info += `• Bash commands: ${modeState.restrictions.allowBash ? "✅ Allowed" : "❌ Blocked"}\n`;
    info += `• Confirmations: ${modeState.restrictions.requireConfirmation ? "✅ Required" : "❌ Not required"}\n`;

    if (modeState.current === "plan" && modeState.planSteps) {
      const completed = modeState.planSteps.filter(s => s.status === "completed").length;
      const total = modeState.planSteps.length;
      info += `\n**Plan Progress**: ${completed}/${total} steps`;
    }

    return info;
  }

  function getModeEmoji(mode: string): string {
    const emojis: Record<string, string> = {
      chat: "💬",
      plan: "📋",
      build: "🔨",
      review: "👀",
    };
    return emojis[mode] || "💬";
  }

  function formatToolName(name: string): string {
    return name
      .split("_")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
}
