import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("session-stats", {
    description: "Show session statistics and token usage",
    handler: async (_args, ctx) => {
      const entries = ctx.sessionManager.getEntries();
      const usage = ctx.getContextUsage();
      
      let stats = `## Session Statistics\n\n`;
      stats += `**Total Entries**: ${entries.length}\n`;
      stats += `**Current Tokens**: ${usage?.tokens?.toLocaleString() || 0}\n`;
      stats += `**Model**: ${usage?.model || "unknown"}\n\n`;

      // Count tool usage
      const toolCounts = new Map<string, number>();
      for (const entry of entries) {
        if (entry.type === "toolResult" && entry.toolName) {
          toolCounts.set(entry.toolName, (toolCounts.get(entry.toolName) || 0) + 1);
        }
      }

      if (toolCounts.size > 0) {
        stats += `### Tool Usage\n\n`;
        const sorted = Array.from(toolCounts.entries()).sort((a, b) => b[1] - a[1]);
        for (const [tool, count] of sorted.slice(0, 10)) {
          stats += `- **${tool}**: ${count} times\n`;
        }
      }

      // Time analysis
      const firstEntry = entries[0]?.timestamp;
      const lastEntry = entries[entries.length - 1]?.timestamp;
      if (firstEntry && lastEntry) {
        const duration = Math.round((lastEntry - firstEntry) / 1000 / 60);
        stats += `\n**Session Duration**: ~${duration} minutes\n`;
      }

      ctx.ui.notify(stats, "info");
    },
  });

  pi.registerCommand("context", {
    description: "Show loaded context (extensions, skills, config files)",
    handler: async (_args, ctx) => {
      const tools = pi.getAllTools();
      const commands = pi.getCommands();
      
      let info = `## Context Overview\n\n`;
      info += `**Working Directory**: ${ctx.cwd}\n`;
      info += `**Total Tools**: ${tools.length}\n`;
      info += `**Available Commands**: ${commands.length}\n\n`;

      // Group tools by source
      const bySource = new Map<string, string[]>();
      for (const tool of tools) {
        const source = tool.sourceInfo?.source || "unknown";
        if (!bySource.has(source)) {
          bySource.set(source, []);
        }
        bySource.get(source)!.push(tool.name);
      }

      info += `### Tools by Source\n\n`;
      for (const [source, toolNames] of bySource) {
        info += `- **${source}**: ${toolNames.length} tools\n`;
      }

      ctx.ui.notify(info, "info");
    },
  });
}
