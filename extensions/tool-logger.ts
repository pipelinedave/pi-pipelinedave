import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  const toolLog: Array<{
    timestamp: number;
    tool: string;
    status: "pending" | "success" | "error" | "partial";
    duration?: number;
    summary?: string;
  }> = [];

  const MAX_LOG_SIZE = 50;

  function logToolEvent(event: {
    tool: string;
    status: "pending" | "success" | "error" | "partial";
    duration?: number;
    summary?: string;
  }) {
    toolLog.push({
      timestamp: Date.now(),
      ...event,
    });

    // Keep log size manageable
    while (toolLog.length > MAX_LOG_SIZE) {
      toolLog.shift();
    }
  }

  function getToolEmoji(toolName: string): string {
    const toolMap: Record<string, string> = {
      read: "📄",
      write: "✏️",
      edit: "🔧",
      bash: "💻",
      filesystem: "📁",
      docker: "🐳",
      kubernetes: "☸️",
      chrome: "🌐",
      sqlite: "🗄️",
      git: "📦",
      tmux: "🖥️",
      search: "🔍",
      time: "⏰",
      memory: "🧠",
    };

    for (const [key, emoji] of Object.entries(toolMap)) {
      if (toolName.toLowerCase().includes(key)) return emoji;
    }
    return "🔧";
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  pi.on("tool_execution_start", async (event, ctx) => {
    logToolEvent({
      tool: event.toolName,
      status: "pending",
    });

    // Show in activity tracker
    const emoji = getToolEmoji(event.toolName);
    ctx.ui.notify(`${emoji} ${formatToolName(event.toolName)} starting...`, "info");
  });

  pi.on("tool_execution_end", async (event, ctx) => {
    const duration = event.details?.duration || 0;
    const status = event.isError ? "error" : "success";
    
    // Create summary
    let summary = "";
    if (event.toolName.includes("read")) {
      summary = event.isError ? "Failed to read" : "Read completed";
    } else if (event.toolName.includes("write")) {
      summary = event.isError ? "Write failed" : "File saved";
    } else if (event.toolName.includes("bash")) {
      summary = event.isError ? "Command failed" : "Command executed";
    } else if (event.toolName.includes("list")) {
      summary = event.isError ? "List failed" : "Listed items";
    }

    logToolEvent({
      tool: event.toolName,
      status: event.isError ? "error" : "success",
      duration,
      summary,
    });

    // Show result
    const emoji = getToolEmoji(event.toolName);
    const statusEmoji = event.isError ? "❌" : "✅";
    const message = `${emoji} ${formatToolName(event.toolName)} ${statusEmoji} ${summary || ""}${duration ? ` (${formatDuration(duration)})` : ""}`;
    
    ctx.ui.notify(message, event.isError ? "error" : "success");
  });

  pi.on("tool_result", async (event, ctx) => {
    // Log partial results for streaming tools
    if (event.content && Array.isArray(event.content)) {
      const text = event.content
        .filter(c => c.type === "text")
        .map(c => c.text)
        .join("");
      
      if (text && text.length > 0) {
        // Could show partial progress here
      }
    }
  });

  // Add command to view tool history
  pi.registerCommand("tool-log", {
    description: "Show recent tool execution history",
    handler: async (_args, ctx) => {
      if (toolLog.length === 0) {
        ctx.ui.notify("No tool executions yet", "info");
        return;
      }

      let log = "## Tool Execution History\n\n";
      
      // Show last 20 tools
      const recent = toolLog.slice(-20).reverse();
      
      for (const entry of recent) {
        const time = new Date(entry.timestamp).toLocaleTimeString();
        const emoji = getToolEmoji(entry.tool);
        const statusEmoji = entry.status === "success" ? "✅" : entry.status === "error" ? "❌" : "⏳";
        const duration = entry.duration ? ` ${formatDuration(entry.duration)}` : "";
        const summary = entry.summary || "";
        
        log += `${time} ${emoji} ${statusEmoji} ${formatToolName(entry.tool)}${duration}\n`;
        if (summary) {
          log += `   └─ ${summary}\n`;
        }
      }

      log += `\n**Total**: ${toolLog.length} executions`;

      ctx.ui.notify(log, "info");
    },
  });

  // Add command to clear tool log
  pi.registerCommand("tool-clear", {
    description: "Clear tool execution history",
    handler: async (_args, ctx) => {
      toolLog.length = 0;
      ctx.ui.notify("Tool log cleared", "success");
    },
  });

  function formatToolName(name: string): string {
    return name
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
}
