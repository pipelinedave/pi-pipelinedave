import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("summary", {
    description: "Generate a summary of the current session",
    handler: async (_args, ctx) => {
      const entries = ctx.sessionManager.getEntries();
      const usage = ctx.getContextUsage();
      
      if (entries.length === 0) {
        ctx.ui.notify("No conversation history yet", "info");
        return;
      }

      // Analyze conversation
      const userMessages = entries.filter(e => e.role === "user").length;
      const assistantMessages = entries.filter(e => e.role === "assistant").length;
      const toolCalls = entries.filter(e => e.type === "toolResult").length;

      // Get recent topics
      const recentTopics = entries
        .slice(-10)
        .filter(e => e.role === "user")
        .map(e => {
          const content = Array.isArray(e.content) 
            ? e.content.find(c => c.type === "text")?.text 
            : e.content;
          return typeof content === "string" ? content.substring(0, 50) : "";
        })
        .filter(t => t);

      let summary = `## Session Summary\n\n`;
      summary += `**Duration**: ${entries.length} messages\n`;
      summary += `**Tokens Used**: ${usage?.tokens?.toLocaleString() || 0}\n`;
      summary += `**Tool Calls**: ${toolCalls}\n\n`;

      summary += `### Recent Topics\n\n`;
      for (const topic of recentTopics.slice(0, 5)) {
        summary += `- ${topic}...\n`;
      }

      summary += `\n### Key Actions\n\n`;
      
      // Count tool usage
      const toolCounts = new Map<string, number>();
      for (const entry of entries) {
        if (entry.type === "toolResult" && entry.toolName) {
          toolCounts.set(entry.toolName, (toolCounts.get(entry.toolName) || 0) + 1);
        }
      }
      
      const topTools = Array.from(toolCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      for (const [tool, count] of topTools) {
        summary += `- **${tool}**: ${count} times\n`;
      }

      ctx.ui.notify(summary, "info");
    },
  });

  pi.registerCommand("whoami", {
    description: "Show current model and API key info",
    handler: async (_args, ctx) => {
      const model = ctx.model;
      if (!model) {
        ctx.ui.notify("No model selected", "error");
        return;
      }

      const info = `## Current Configuration\n\n`;
      info += `**Model**: ${model.provider}/${model.id}\n`;
      info += `**Provider**: ${model.provider}\n`;
      info += `**Context Window**: ${model.contextWindow?.toLocaleString()} tokens\n`;
      info += `**Max Output**: ${model.maxTokens?.toLocaleString()} tokens\n\n`;

      // Masked API key info
      const apiKey = process.env[`OPENAI_API_KEY`] || 
                     process.env[`ANTHROPIC_API_KEY`] ||
                     process.env[`GOOGLE_API_KEY`];
      
      if (apiKey) {
        const masked = apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4);
        info += `**API Key**: ${masked}\n`;
        info += `**Key Status**: ✓ Configured\n`;
      } else {
        info += `**API Key**: ⚠ Not found\n`;
      }

      ctx.ui.notify(info, "info");
    },
  });
}
