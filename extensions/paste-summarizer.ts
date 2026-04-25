import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let lastInputTime = 0;
  let lastInputLength = 0;
  let pasteBuffer: { text: string; lines: number; timestamp: number } | null = null;

  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return;

    const now = Date.now();
    const text = typeof event.text === "string" ? event.text : "";
    const lines = text.split("\n").length;

    // Detect paste: rapid input with multiple lines
    const timeDiff = now - lastInputTime;
    const isRapid = timeDiff < 100; // Less than 100ms between inputs
    const isMultiLine = lines > 3; // More than 3 lines
    const isLong = text.length > 100; // More than 100 chars

    if ((isRapid && isMultiLine) || isLong) {
      // This looks like a paste
      pasteBuffer = {
        text,
        lines,
        timestamp: now,
      };

      // Transform the input to show paste summary
      // But keep the actual content for the LLM
      const pasteSummary = `[paste: ${lines} lines, ${text.length} chars]`;
      
      // We can't modify event.text after the fact in the input handler
      // But we can add context about the paste
      event.text = `${pasteSummary}\n\n${text}`;
      
      ctx.ui.notify(pasteSummary, "info");
    }

    lastInputTime = now;
    lastInputLength = text.length;

    return { action: "continue" };
  });

  // Add a command to view recent pastes
  pi.registerCommand("pastes", {
    description: "Show recent paste history",
    handler: async (_args, ctx) => {
      if (!pasteBuffer) {
        ctx.ui.notify("No recent pastes", "info");
        return;
      }

      const age = Math.round((Date.now() - pasteBuffer.timestamp) / 1000);
      const summary = `**Most Recent Paste**:
- Lines: ${pasteBuffer.lines}
- Characters: ${pasteBuffer.text.length}
- Age: ${age}s ago

**Preview** (first 500 chars):
\`\`\`
${pasteBuffer.text.substring(0, 500)}${pasteBuffer.text.length > 500 ? "..." : ""}
\`\`\`
`;

      ctx.ui.notify(summary, "info");
    },
  });

  // Clear paste buffer
  pi.on("turn_start", async () => {
    pasteBuffer = null;
  });
}
