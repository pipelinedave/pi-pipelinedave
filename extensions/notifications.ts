import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("agent_end", async (_event, ctx) => {
    // Send desktop notification when agent finishes
    if (ctx.hasUI) {
      try {
        // OSC 777 desktop notification escape sequence
        const title = "Pi Agent";
        const body = "Ready for your next command";
        process.stdout.write(`\x1b]9;4;3;${title}\x07`);
        process.stdout.write(`\x1b]9;4;2;${body}\x07`);
      } catch {
        // Ignore notification errors
      }
    }
  });

  pi.on("tool_execution_start", async (event, ctx) => {
    // Notify when long-running tool starts
    if (["bash", "write"].includes(event.toolName)) {
      try {
        process.stdout.write(`\x1b]9;4;1;${event.toolName}\x07`);
      } catch {
        // Ignore
      }
    }
  });
}
