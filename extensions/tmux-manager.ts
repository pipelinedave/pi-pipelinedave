import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { spawn } from "node:child_process";

interface TmuxSession {
  name: string;
  windows: number;
  attached: boolean;
  created: number;
}

function execTmux(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn("tmux", args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => (stdout += data.toString()));
    proc.stderr?.on("data", (data) => (stderr += data.toString()));

    proc.on("close", (code) => resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code || 0 }));
    proc.on("error", (err) => resolve({ stdout: "", stderr: err.message, code: -1 }));
  });
}

export default function (pi: ExtensionAPI) {
  // Check if tmux is available
  async function hasTmux() {
    const { execSync } = await import("node:child_process");
    try {
      execSync("which tmux", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  pi.registerTool({
    name: "tmux_new_session",
    label: "Tmux: New Session",
    description: "Create a new detached tmux session with a command",
    parameters: Type.Object({
      name: Type.String({ description: "Session name" }),
      command: Type.String({ description: "Command to run" }),
      cwd: Type.Optional(Type.String({ description: "Working directory" })),
    }),
    async execute(_id, params) {
      if (!(await hasTmux())) {
        return { content: [{ type: "text", text: "Error: tmux not installed" }], isError: true, details: {} };
      }

      const args = ["new-session", "-d", "-s", params.name];
      if (params.cwd) {
        args.unshift("-c", params.cwd);
      }
      args.push(params.command);

      const result = await execTmux(args);
      if (result.code !== 0) {
        return { content: [{ type: "text", text: `Error: ${result.stderr}` }], isError: true, details: {} };
      }

      return {
        content: [{ type: "text", text: `✓ Session '${params.name}' created\nCommand: ${params.command}` }],
        details: { session: params.name, command: params.command },
      };
    },
  });

  pi.registerTool({
    name: "tmux_list_sessions",
    label: "Tmux: List Sessions",
    description: "List all active tmux sessions",
    parameters: Type.Object({}),
    async execute() {
      if (!(await hasTmux())) {
        return { content: [{ type: "text", text: "Error: tmux not installed" }], isError: true, details: {} };
      }

      const result = await execTmux(["list-sessions"]);
      if (result.code !== 0 || !result.stdout) {
        return { content: [{ type: "text", text: "No active tmux sessions" }], details: {} };
      }

      const sessions = result.stdout.split("\n").map((line) => {
        const match = line.match(/^([^:]+):/);
        return match ? `• ${match[1]}` : line;
      });

      return {
        content: [{ type: "text", text: `Active Tmux Sessions:\n${sessions.join("\n")}` }],
        details: { count: sessions.length },
      };
    },
  });

  pi.registerTool({
    name: "tmux_attach",
    label: "Tmux: Attach",
    description: "Attach to an existing tmux session",
    parameters: Type.Object({
      name: Type.String({ description: "Session name to attach to" }),
    }),
    async execute(_id, params) {
      if (!(await hasTmux())) {
        return { content: [{ type: "text", text: "Error: tmux not installed" }], isError: true, details: {} };
      }

      // Note: This will block until detached
      const result = await execTmux(["attach-session", "-t", params.name]);
      if (result.code !== 0) {
        return { content: [{ type: "text", text: `Error: ${result.stderr}` }], isError: true, details: {} };
      }

      return { content: [{ type: "text", text: `Attached to session '${params.name}'` }], details: {} };
    },
  });

  pi.registerTool({
    name: "tmux_send_keys",
    label: "Tmux: Send Keys",
    description: "Send keys/commands to a tmux session",
    parameters: Type.Object({
      session: Type.String({ description: "Session name" }),
      keys: Type.String({ description: "Keys or command to send" }),
      enter: Type.Optional(Type.Boolean({ description: "Press Enter after sending", default: true })),
    }),
    async execute(_id, params) {
      if (!(await hasTmux())) {
        return { content: [{ type: "text", text: "Error: tmux not installed" }], isError: true, details: {} };
      }

      const args = ["send-keys", "-t", params.session];
      if (params.enter !== false) {
        args.push(params.keys, "Enter");
      } else {
        args.push(params.keys);
      }

      const result = await execTmux(args);
      if (result.code !== 0) {
        return { content: [{ type: "text", text: `Error: ${result.stderr}` }], isError: true, details: {} };
      }

      return {
        content: [{ type: "text", text: `✓ Sent to '${params.session}': ${params.keys}` }],
        details: { session: params.session, keys: params.keys },
      };
    },
  });

  pi.registerTool({
    name: "tmux_capture_pane",
    label: "Tmux: Capture Pane",
    description: "Capture the current content of a tmux session pane",
    parameters: Type.Object({
      session: Type.String({ description: "Session name" }),
      target: Type.Optional(Type.String({ description: "Target pane (default: active)" })),
    }),
    async execute(_id, params) {
      if (!(await hasTmux())) {
        return { content: [{ type: "text", text: "Error: tmux not installed" }], isError: true, details: {} };
      }

      const args = ["capture-pane", "-p", "-t", params.target || params.session];
      const result = await execTmux(args);

      if (result.code !== 0) {
        return { content: [{ type: "text", text: `Error: ${result.stderr}` }], isError: true, details: {} };
      }

      const lines = result.stdout.split("\n");
      const truncated = lines.length > 100 ? lines.slice(0, 100).join("\n") + "\n... (truncated)" : result.stdout;

      return {
        content: [{ type: "text", text: `Session: ${params.session}\n\n${truncated}` }],
        details: { session: params.session, lines: lines.length },
      };
    },
  });

  pi.registerTool({
    name: "tmux_kill_session",
    label: "Tmux: Kill Session",
    description: "Terminate a tmux session",
    parameters: Type.Object({
      name: Type.String({ description: "Session name to kill" }),
      force: Type.Optional(Type.Boolean({ description: "Force kill", default: false })),
    }),
    async execute(_id, params) {
      if (!(await hasTmux())) {
        return { content: [{ type: "text", text: "Error: tmux not installed" }], isError: true, details: {} };
      }

      const args = ["kill-session", "-t", params.name];
      const result = await execTmux(args);

      if (result.code !== 0) {
        return { content: [{ type: "text", text: `Error: ${result.stderr}` }], isError: true, details: {} };
      }

      return {
        content: [{ type: "text", text: `✓ Session '${params.name}' terminated` }],
        details: { session: params.name },
      };
    },
  });

  pi.registerCommand("tmux", {
    description: "Manage tmux sessions",
    handler: async (args, ctx) => {
      if (!(await hasTmux())) {
        ctx.ui.notify("tmux is not installed", "error");
        return;
      }

      const [cmd, sessionName, ...rest] = args?.split(" ") || [];

      switch (cmd) {
        case "list":
          const result = await execTmux(["list-sessions"]);
          ctx.ui.notify(result.stdout || "No active sessions", "info");
          break;

        case "new":
          if (!sessionName) {
            ctx.ui.notify("Usage: /tmux new <session-name> [command]", "error");
            return;
          }
          const command = rest.join(" ") || "bash";
          await execTmux(["new-session", "-d", "-s", sessionName, command]);
          ctx.ui.notify(`✓ Created session: ${sessionName}`, "success");
          break;

        case "attach":
          if (!sessionName) {
            ctx.ui.notify("Usage: /tmux attach <session-name>", "error");
            return;
          }
          await execTmux(["attach-session", "-t", sessionName]);
          break;

        case "kill":
          if (!sessionName) {
            ctx.ui.notify("Usage: /tmux kill <session-name>", "error");
            return;
          }
          await execTmux(["kill-session", "-t", sessionName]);
          ctx.ui.notify(`✓ Killed session: ${sessionName}`, "success");
          break;

        case "send":
          if (!sessionName || !rest.length) {
            ctx.ui.notify("Usage: /tmux send <session-name> <command>", "error");
            return;
          }
          await execTmux(["send-keys", "-t", sessionName, ...rest, "Enter"]);
          ctx.ui.notify(`✓ Sent to ${sessionName}: ${rest.join(" ")}`, "success");
          break;

        case "capture":
          if (!sessionName) {
            ctx.ui.notify("Usage: /tmux capture <session-name>", "error");
            return;
          }
          const capture = await execTmux(["capture-pane", "-p", "-t", sessionName]);
          ctx.ui.notify(capture.stdout || "Empty session", "info");
          break;

        default:
          ctx.ui.notify(
            "Tmux Commands:\n" +
              "  /tmux list - List sessions\n" +
              "  /tmux new <name> [cmd] - Create session\n" +
              "  /tmux attach <name> - Attach to session\n" +
              "  /tmux kill <name> - Kill session\n" +
              "  /tmux send <name> <cmd> - Send command\n" +
              "  /tmux capture <name> - Capture output",
            "info"
          );
      }
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    if (await hasTmux()) {
      const result = await execTmux(["list-sessions"]);
      if (result.stdout) {
        const count = result.stdout.split("\n").length;
        ctx.ui.notify(`Tmux: ${count} active session(s)`, "info");
      }
    }
  });
}
