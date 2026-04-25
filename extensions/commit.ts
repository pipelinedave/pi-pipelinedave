import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("commit", {
    description: "Generate commit message and commit changes",
    handler: async (args, ctx) => {
      try {
        const { execSync } = await import("node:child_process");

        // Check if we're in a git repo
        try {
          execSync("git rev-parse --git-dir", { stdio: "ignore" });
        } catch {
          ctx.ui.notify("Not a git repository", "error");
          return;
        }

        // Stage all changes
        const stageCmd = args ? `git add ${args}` : "git add -A";
        execSync(stageCmd, { encoding: "utf-8" });

        // Get diff
        const diff = execSync("git diff --cached", { encoding: "utf-8" });
        if (!diff.trim()) {
          ctx.ui.notify("No changes to commit", "info");
          return;
        }

        // Ask LLM for commit message
        ctx.ui.notify("Generating commit message...", "info");
        
        // Send to LLM via pi's messaging
        const prompt = `Based on this git diff, generate a concise conventional commit message (max 72 chars subject line):

${diff.substring(0, 2000)}

Return ONLY the commit message, no other text.`;

        // For now, just show the diff and let user decide
        ctx.ui.notify(
          `Changes staged for commit:\n\n${diff.substring(0, 500)}${diff.length > 500 ? "..." : ""}`,
          "info"
        );
        
        ctx.ui.notify(
          "Use: git commit -m 'your message'\nOr ask me to generate a message based on the changes",
          "info"
        );

      } catch (err: any) {
        ctx.ui.notify(`Commit failed: ${err.message}`, "error");
      }
    },
  });

  pi.registerTool({
    name: "git_commit",
    label: "Git Commit",
    description: "Stage changes and generate a commit message",
    parameters: Type.Object({
      message: Type.Optional(Type.String({ description: "Commit message (auto-generated if omitted)" })),
      all: Type.Optional(Type.Boolean({ description: "Stage all changes", default: true })),
    }),
    async execute(_id, params) {
      try {
        const { execSync } = await import("node:child_process");

        // Stage changes
        if (params.all) {
          execSync("git add -A", { encoding: "utf-8" });
        }

        // Get diff for message generation
        const diff = execSync("git diff --cached", { encoding: "utf-8" });
        if (!diff.trim()) {
          return { content: [{ type: "text", text: "No changes to commit" }], details: {} };
        }

        // Generate message if not provided
        let message = params.message;
        if (!message) {
          // Simple heuristic-based message generation
          const lines = diff.split("\n");
          const added = lines.filter(l => l.startsWith("+")).length;
          const removed = lines.filter(l => l.startsWith("-")).length;
          
          if (added > removed) {
            message = `feat: add ${Math.min(added, 10)} new lines`;
          } else if (removed > added) {
            message = `refactor: remove ${Math.min(removed, 10)} lines`;
          } else {
            message = `chore: update code`;
          }
        }

        // Commit
        execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { encoding: "utf-8" });

        return {
          content: [{ type: "text", text: `✓ Committed: ${message}` }],
          details: { message, added: diff.split("\n").filter(l => l.startsWith("+")).length },
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true, details: {} };
      }
    },
  });
}
