import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export default function (pi: ExtensionAPI) {
  let lastStash: string | null = null;

  async function exec(cmd: string, cwd: string) {
    try {
      const { execSync } = await import("node:child_process");
      return execSync(cmd, { cwd, encoding: "utf-8", timeout: 10000 }).trim();
    } catch (err: any) {
      return null;
    }
  }

  async function isGitRepo(cwd: string) {
    return (await exec("git rev-parse --git-dir", cwd)) !== null;
  }

  async function getGitStatus(cwd: string) {
    return await exec("git status --short", cwd);
  }

  async function createStash(cwd: string, message: string) {
    return await exec(`git stash push -m "${message}"`, cwd);
  }

  async function applyStash(cwd: string) {
    return await exec("git stash pop", cwd);
  }

  async function getCurrentBranch(cwd: string) {
    return await exec("git branch --show-current", cwd);
  }

  async function createBranch(cwd: string, name: string) {
    return await exec(`git checkout -b "${name}"`, cwd);
  }

  pi.on("session_start", async (_event, ctx) => {
    // Auto-stash if there are uncommitted changes
    const isGit = await isGitRepo(ctx.cwd);
    if (!isGit) return;

    const status = await getGitStatus(ctx.cwd);
    if (status) {
      const stashMsg = `pi-backup-${Date.now()}`;
      const result = await createStash(ctx.cwd, stashMsg);
      if (result) {
        lastStash = stashMsg;
        // Only notify if there were actual changes
        if (status.split('\n').filter(l => l.trim()).length > 0) {
          ctx.ui.notify(`Git: Stashed ${status.split('\n').filter(l => l.trim()).length} changes`, "info");
        }
      }
    }
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    // Auto-apply stash on exit if we stashed
    if (lastStash) {
      const isGit = await isGitRepo(ctx.cwd);
      if (isGit) {
        const result = await applyStash(ctx.cwd);
        if (result !== null) {
          ctx.ui.notify(`Git: Restored stash "${lastStash}"`, "success");
          lastStash = null;
        }
      }
    }
  });

  pi.registerCommand("git-checkpoint", {
    description: "Create a git checkpoint (stash)",
    handler: async (args, ctx) => {
      const isGit = await isGitRepo(ctx.cwd);
      if (!isGit) {
        ctx.ui.notify("Not a git repository", "error");
        return;
      }

      const message = args || `checkpoint-${Date.now()}`;
      const result = await createStash(ctx.cwd, message);

      if (result) {
        ctx.ui.notify(`Checkpoint created: ${message}`, "success");
      } else {
        ctx.ui.notify("No changes to stash", "info");
      }
    },
  });

  pi.registerCommand("git-restore", {
    description: "Restore stashed changes",
    handler: async (_args, ctx) => {
      const isGit = await isGitRepo(ctx.cwd);
      if (!isGit) {
        ctx.ui.notify("Not a git repository", "error");
        return;
      }

      const result = await applyStash(ctx.cwd);
      if (result !== null) {
        ctx.ui.notify("Changes restored", "success");
      } else {
        ctx.ui.notify("No stash to restore", "error");
      }
    },
  });

  pi.registerCommand("git-branch", {
    description: "Create and switch to a new branch",
    handler: async (args, ctx) => {
      if (!args) {
        ctx.ui.notify("Usage: /git-branch <branch-name>", "error");
        return;
      }

      const isGit = await isGitRepo(ctx.cwd);
      if (!isGit) {
        ctx.ui.notify("Not a git repository", "error");
        return;
      }

      const result = await createBranch(ctx.cwd, args);
      if (result) {
        ctx.ui.notify(`Created and switched to branch: ${args}`, "success");
      } else {
        ctx.ui.notify("Failed to create branch", "error");
      }
    },
  });

  pi.registerCommand("git-status", {
    description: "Show git status",
    handler: async (_args, ctx) => {
      const isGit = await isGitRepo(ctx.cwd);
      if (!isGit) {
        ctx.ui.notify("Not a git repository", "info");
        return;
      }

      const status = await getGitStatus(ctx.cwd);
      const branch = await getCurrentBranch(ctx.cwd);

      let msg = `Branch: ${branch || "unknown"}\n\n`;
      msg += status || "No changes";

      ctx.ui.notify(msg, "info");
    },
  });
}
