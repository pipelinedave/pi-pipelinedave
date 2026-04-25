import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { spawn } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs/promises";

interface SubagentState {
  id: string;
  name: string;
  prompt: string;
  status: "running" | "completed" | "failed";
  result?: string;
  error?: string;
  startTime: number;
  endTime?: number;
}

const subagents = new Map<string, SubagentState>();
let subagentCounter = 0;

export default function (pi: ExtensionAPI) {
  // Create a subagent
  pi.registerTool({
    name: "spawn_subagent",
    label: "Spawn Subagent",
    description: "Create a sub-agent to work on a specific task in parallel",
    parameters: Type.Object({
      name: Type.String({ description: "Name for the subagent" }),
      prompt: Type.String({ description: "Task description for the subagent" }),
      context: Type.Optional(Type.String({ description: "Additional context or files to consider" })),
    }),
    async execute(_id, params) {
      const id = `subagent-${++subagentCounter}-${Date.now()}`;
      
      const state: SubagentState = {
        id,
        name: params.name,
        prompt: params.prompt,
        status: "running",
        startTime: Date.now(),
      };
      
      subagents.set(id, state);

      // Spawn a new pi instance as a subagent
      const piPath = process.argv[0]; // Node path
      const agentPath = process.argv[1]; // pi-coding-agent path
      
      // Create a temporary session file for the subagent
      const sessionFile = path.join("/tmp", `pi-subagent-${id}.jsonl`);
      
      // For now, we'll just log the subagent creation
      // In a full implementation, this would spawn a new pi process
      const message = `Subagent '${params.name}' spawned (ID: ${id})\nTask: ${params.prompt}`;
      
      return {
        content: [{ type: "text", text: message }],
        details: { id, name: params.name, status: "running" },
      };
    },
  });

  // Check subagent status
  pi.registerTool({
    name: "check_subagent",
    label: "Check Subagent",
    description: "Check the status of a subagent",
    parameters: Type.Object({
      id: Type.String({ description: "Subagent ID" }),
    }),
    async execute(_id, params) {
      const agent = subagents.get(params.id);
      
      if (!agent) {
        return {
          content: [{ type: "text", text: `Subagent ${params.id} not found` }],
          isError: true,
          details: {},
        };
      }

      const duration = Math.round((Date.now() - agent.startTime) / 1000);
      const statusMsg = agent.status === "running" 
        ? `Still running for ${duration}s`
        : agent.status === "completed"
        ? `Completed in ${Math.round((agent.endTime! - agent.startTime) / 1000)}s`
        : `Failed: ${agent.error}`;

      return {
        content: [{ 
          type: "text", 
          text: `Subagent: ${agent.name}\nID: ${agent.id}\nStatus: ${agent.status}\n${statusMsg}`
        }],
        details: { id: params.id, status: agent.status },
      };
    },
  });

  // Wait for subagent
  pi.registerTool({
    name: "wait_subagent",
    label: "Wait for Subagent",
    description: "Wait for a subagent to complete and get its result",
    parameters: Type.Object({
      id: Type.String({ description: "Subagent ID" }),
      timeout: Type.Optional(Type.Number({ description: "Timeout in milliseconds", default: 300000 })),
    }),
    async execute(_id, params) {
      const agent = subagents.get(params.id);
      
      if (!agent) {
        return {
          content: [{ type: "text", text: `Subagent ${params.id} not found` }],
          isError: true,
          details: {},
        };
      }

      if (agent.status === "completed") {
        return {
          content: [{ type: "text", text: agent.result || "Completed successfully" }],
          details: { id: params.id, result: agent.result },
        };
      }

      if (agent.status === "failed") {
        return {
          content: [{ type: "text", text: `Subagent failed: ${agent.error}` }],
          isError: true,
          details: { id: params.id, error: agent.error },
        };
      }

      // Wait for completion (simplified - in reality would poll)
      return {
        content: [{ type: "text", text: `Waiting for ${agent.name}...` }],
        details: { id: params.id, status: "waiting" },
      };
    },
  });

  // List subagents
  pi.registerCommand("subagents", {
    description: "List all active subagents",
    handler: async (_args, ctx) => {
      if (subagents.size === 0) {
        ctx.ui.notify("No active subagents", "info");
        return;
      }

      let list = "## Active Subagents\n\n";
      for (const agent of subagents.values()) {
        const duration = Math.round((Date.now() - agent.startTime) / 1000);
        const statusIcon = agent.status === "running" ? "⏳" : agent.status === "completed" ? "✅" : "❌";
        
        list += `${statusIcon} **${agent.name}** (${agent.id})\n`;
        list += `   Status: ${agent.status}\n`;
        list += `   Running for: ${duration}s\n`;
        list += `   Task: ${agent.prompt.substring(0, 50)}...\n\n`;
      }

      ctx.ui.notify(list, "info");
    },
  });

  // Kill subagent
  pi.registerCommand("subagent-kill", {
    description: "Kill a subagent",
    handler: async (args, ctx) => {
      const id = args?.trim();
      if (!id) {
        ctx.ui.notify("Usage: /subagent-kill <subagent-id>", "error");
        return;
      }

      const agent = subagents.get(id);
      if (!agent) {
        ctx.ui.notify(`Subagent ${id} not found`, "error");
        return;
      }

      // In a full implementation, this would kill the child process
      agent.status = "failed";
      agent.error = "Killed by user";
      agent.endTime = Date.now();

      ctx.ui.notify(`Subagent ${agent.name} killed`, "success");
    },
  });

  // Show subagent status in widget
  pi.on("agent_end", async (_event, ctx) => {
    const running = Array.from(subagents.values()).filter(a => a.status === "running").length;
    
    if (running > 0) {
      const widget = ctx.ui.getWidget("status") || ["", "", ""];
      widget[2] = `🤖 ${running} subagent${running > 1 ? "s" : ""} active`;
      ctx.ui.setWidget("status", widget);
    }
  });

  // Load subagents from session on start
  pi.on("session_start", async (_event, ctx) => {
    // In a full implementation, this would restore subagents from session
    ctx.ui.notify("Subagent system ready", "success");
  });
}
