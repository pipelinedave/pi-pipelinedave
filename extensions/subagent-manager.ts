import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { spawn, ChildProcess } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { Type } from "typebox";
import {
  ProtocolSerializer,
  MessageIdGenerator,
  validateRequest,
  validateResponse,
  validateResult,
  createErrorResponse,
  createSuccessResponse,
  type SubagentRequest,
  type SubagentResponse,
  type SubagentResult,
  type SubagentStatus,
  type ExecuteParams,
} from "./lib/subagent-protocol.js";

interface SubagentInstance {
  id: string;
  name: string;
  process: ChildProcess;
  status: SubagentStatus;
  progress: number;
  message?: string;
  result?: string;
  error?: string;
  startTime: number;
  endTime?: number;
  timeout?: NodeJS.Timeout;
  stdin: NodeJS.WritableStream;
  serializer: ProtocolSerializer;
  pendingRequests: Map<number, {
    resolve: (result: SubagentResult) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>;
}

export default function (pi: ExtensionAPI) {
  const agents = new Map<string, SubagentInstance>();
  const idGenerator = new MessageIdGenerator();
  const serializer = new ProtocolSerializer();
  let agentCounter = 0;
  let active = true;

  // Get the runner script path
  const runnerScript = "/home/dhallmann/.pi/agent/subagent-runner.js";

  async function spawnSubagent(
    ctx: any,
    name: string,
    task: string,
    context?: string[],
    timeoutMs: number = 300000
  ): Promise<{ id: string; status: string }> {
    const id = `subagent-${++agentCounter}-${Date.now()}`;

    // Create temporary session file for subagent
    const sessionFile = path.join("/tmp", `pi-subagent-${id}.jsonl`);
    await fs.writeFile(sessionFile, JSON.stringify({
      id,
      name,
      task,
      context,
      parentPid: process.pid,
      startTime: Date.now(),
    }, null, 2));

    // Spawn the subagent process
    const proc = spawn("node", [
      runnerScript,
      "--session-file", sessionFile,
      "--parent-id", id
    ], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
      env: { ...process.env, PI_SUBAGENT: "true", PI_PARENT_PID: String(process.pid) },
    });

    const instance: SubagentInstance = {
      id,
      name,
      process: proc,
      status: "spawning",
      progress: 0,
      startTime: Date.now(),
      stdin: proc.stdin,
      serializer: new ProtocolSerializer(),
      pendingRequests: new Map(),
    };

    agents.set(id, instance);

    // Handle stdout (responses from subagent)
    proc.stdout?.on("data", (data: Buffer) => {
      const messages = serializer.deserialize(data.toString());
      for (const msg of messages) {
        if (validateResponse(msg)) {
          handleResponse(id, msg);
        }
      }
    });

    // Handle stderr (logs/errors from subagent)
    proc.stderr?.on("data", (data: Buffer) => {
      const text = data.toString().trim();
      if (text) {
        console.log(`[Subagent ${id}] ${text}`);
      }
    });

    // Handle process exit
    proc.on("exit", (code, signal) => {
      handleExit(id, code, signal);
    });

    // Handle process error
    proc.on("error", (err) => {
      instance.status = "failed";
      instance.error = err.message;
      instance.endTime = Date.now();
      notifyStatusChange(ctx, instance);
    });

    // Mark as running after brief delay
    setTimeout(() => {
      if (instance.status === "spawning") {
        instance.status = "running";
        notifyStatusChange(ctx, instance);
      }
    }, 100);

    // Set up timeout
    instance.timeout = setTimeout(() => {
      killSubagent(ctx, id, true);
    }, timeoutMs);

    ctx.ui.notify(`Subagent '${name}' spawned (ID: ${id})`, "success");
    
    return { id, status: "spawning" };
  }

  async function executeTask(
    id: string,
    task: string,
    context?: string[],
    timeoutMs: number = 300000
  ): Promise<SubagentResult> {
    const instance = agents.get(id);
    if (!instance) {
      throw new Error(`Subagent ${id} not found`);
    }

    if (instance.status !== "running" && instance.status !== "paused") {
      throw new Error(`Subagent ${id} is not running (status: ${instance.status})`);
    }

    return new Promise((resolve, reject) => {
      const reqId = idGenerator.generate();
      
      const request: SubagentRequest = {
        jsonrpc: "2.0",
        id: reqId,
        method: "execute",
        params: { task, context, timeout: timeoutMs },
      };

      const timeout = setTimeout(() => {
        idGenerator.release(reqId);
        instance.pendingRequests.delete(reqId);
        reject(new Error(`Request ${reqId} timed out`));
      }, timeoutMs);

      instance.pendingRequests.set(reqId, { resolve, reject, timeout });

      const message = serializer.serialize(request);
      instance.stdin.write(message);
    });
  }

  function handleResponse(id: string, response: SubagentResponse): void {
    const instance = agents.get(id);
    if (!instance) return;

    const pending = instance.pendingRequests.get(response.id);
    if (pending) {
      clearTimeout(pending.timeout);
      idGenerator.release(response.id);
      instance.pendingRequests.delete(response.id);

      if (response.error) {
        pending.reject(new Error(response.error.message));
      } else if (response.result && validateResult(response.result)) {
        updateInstance(id, response.result);
        pending.resolve(response.result);
      }
    } else {
      // Unsolicited response (progress update)
      if (response.result && validateResult(response.result)) {
        updateInstance(id, response.result);
      }
    }
  }

  function updateInstance(id: string, result: SubagentResult): void {
    const instance = agents.get(id);
    if (!instance) return;

    instance.status = result.status;
    instance.progress = result.progress;
    instance.message = result.message;
    instance.result = result.result;
    instance.error = result.error;
    instance.endTime = result.status === "completed" || result.status === "failed" 
      ? Date.now() 
      : instance.endTime;
  }

  function handleExit(id: string, code: number | null, signal: NodeJS.Signals | null): void {
    const instance = agents.get(id);
    if (!instance) return;

    instance.status = signal === "SIGKILL" ? "killed" : 
                      code !== 0 ? "failed" : 
                      instance.status === "running" ? "completed" : instance.status;
    
    instance.endTime = Date.now();
    
    // Reject all pending requests
    for (const [reqId, pending] of instance.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`Process exited with code ${code}, signal ${signal}`));
      idGenerator.release(reqId);
    }
    instance.pendingRequests.clear();
  }

  function killSubagent(ctx: any, id: string, force: boolean = false): void {
    const instance = agents.get(id);
    if (!instance) return;

    if (instance.timeout) {
      clearTimeout(instance.timeout);
    }

    if (force) {
      instance.process.kill("SIGKILL");
    } else {
      instance.process.kill("SIGTERM");
    }

    instance.status = "killed";
    instance.endTime = Date.now();
    ctx.ui.notify(`Subagent '${instance.name}' killed`, "warning");
  }

  function notifyStatusChange(ctx: any, instance: SubagentInstance): void {
    // Update status bar
    const running = Array.from(agents.values()).filter(a => 
      a.status === "running" || a.status === "paused"
    ).length;

    if (ctx.ui?.setWidget) {
      // Just set the widget without trying to get existing content
      const widgetContent = ["", "", `🤖 ${running} subagent${running !== 1 ? "s" : ""} active`];
      try {
        ctx.ui.setWidget("status", widgetContent);
      } catch (e) {
        // Silently fail if widget API is not available
      }
    }

    // Send notification for completion
    if (instance.status === "completed") {
      const duration = Math.round((instance.endTime! - instance.startTime) / 1000);
      try {
        ctx.ui.notify(
          `✅ Subagent '${instance.name}' completed in ${duration}s\n${instance.result}`,
          "success"
        );
      } catch (e) {
        // Notify might not be available
      }
    } else if (instance.status === "failed") {
      try {
        ctx.ui.notify(
          `❌ Subagent '${instance.name}' failed: ${instance.error}`,
          "error"
        );
      } catch (e) {
        // Notify might not be available
      }
    }
  }

  // Register tools
  pi.registerTool({
    name: "spawn_subagent",
    label: "Spawn Subagent",
    description: "Create a sub-agent to work on a specific task in parallel",
    parameters: Type.Object({
      name: Type.String({ description: "Name for the subagent" }),
      prompt: Type.String({ description: "Task description for the subagent" }),
      context: Type.Optional(Type.String({ description: "Additional context or files to consider" })),
      timeout: Type.Optional(Type.Number({ description: "Timeout in milliseconds", default: 300000 })),
    }),
    async execute(_id, params, ctx) {
      const context = params.context 
        ? params.context.split(",").map(s => s.trim())
        : undefined;

      const result = await spawnSubagent(
        ctx,
        params.name,
        params.prompt,
        context,
        params.timeout
      );

      return {
        content: [{ 
          type: "text", 
          text: `Subagent '${params.name}' spawned successfully!\nID: ${result.id}\nStatus: ${result.status}\n\nUse /subagents to monitor progress.`
        }],
        details: { id: result.id, name: params.name, status: result.status },
      };
    },
  });

  pi.registerTool({
    name: "check_subagent",
    label: "Check Subagent",
    description: "Check the status of a subagent",
    parameters: Type.Object({
      id: Type.String({ description: "Subagent ID" }),
    }),
    async execute(_id, params) {
      const instance = agents.get(params.id);
      
      if (!instance) {
        return {
          content: [{ type: "text", text: `Subagent ${params.id} not found` }],
          isError: true,
          details: {},
        };
      }

      const duration = Math.round((Date.now() - instance.startTime) / 1000);
      const statusMsg = instance.status === "running" 
        ? `Still running for ${duration}s`
        : instance.status === "completed"
        ? `Completed in ${Math.round((instance.endTime! - instance.startTime) / 1000)}s`
        : `Failed: ${instance.error}`;

      let resultText = `Subagent: ${instance.name}\n`;
      resultText += `ID: ${instance.id}\n`;
      resultText += `Status: ${instance.status}\n`;
      resultText += `Progress: ${instance.progress}%\n`;
      resultText += `Duration: ${duration}s\n`;
      
      if (instance.message) resultText += `Message: ${instance.message}\n`;
      if (instance.result) resultText += `Result: ${instance.result}\n`;
      if (instance.error) resultText += `Error: ${instance.error}\n`;

      return {
        content: [{ type: "text", text: resultText }],
        details: { 
          id: params.id, 
          status: instance.status,
          progress: instance.progress,
        },
      };
    },
  });

  pi.registerTool({
    name: "wait_subagent",
    label: "Wait for Subagent",
    description: "Wait for a subagent to complete and get its result",
    parameters: Type.Object({
      id: Type.String({ description: "Subagent ID" }),
      timeout: Type.Optional(Type.Number({ description: "Timeout in milliseconds", default: 300000 })),
    }),
    async execute(_id, params, ctx) {
      const instance = agents.get(params.id);
      
      if (!instance) {
        return {
          content: [{ type: "text", text: `Subagent ${params.id} not found` }],
          isError: true,
          details: {},
        };
      }

      if (instance.status === "completed") {
        return {
          content: [{ type: "text", text: instance.result || "Completed successfully" }],
          details: { id: params.id, result: instance.result },
        };
      }

      if (instance.status === "failed") {
        return {
          content: [{ type: "text", text: `Subagent failed: ${instance.error}` }],
          isError: true,
          details: { id: params.id, error: instance.error },
        };
      }

      if (instance.status === "killed") {
        return {
          content: [{ type: "text", text: `Subagent was killed` }],
          isError: true,
          details: { id: params.id, status: "killed" },
        };
      }

      // Wait for completion
      ctx.ui.notify(`Waiting for ${instance.name}...`, "info");
      
      const maxWait = params.timeout || 300000;
      const startTime = Date.now();
      
      while (instance.status === "running" || instance.status === "paused") {
        if (Date.now() - startTime > maxWait) {
          return {
            content: [{ type: "text", text: `Timeout waiting for ${instance.name}` }],
            isError: true,
            details: { id: params.id, status: "timeout" },
          };
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (instance.status === "completed") {
        return {
          content: [{ type: "text", text: instance.result || "Completed successfully" }],
          details: { id: params.id, result: instance.result },
        };
      }

      return {
        content: [{ type: "text", text: `Subagent ${instance.status}: ${instance.error || ""}` }],
        isError: instance.status !== "completed",
        details: { id: params.id, status: instance.status },
      };
    },
  });

  pi.registerTool({
    name: "kill_subagent",
    label: "Kill Subagent",
    description: "Kill a running subagent",
    parameters: Type.Object({
      id: Type.String({ description: "Subagent ID" }),
      force: Type.Optional(Type.Boolean({ description: "Force kill", default: false })),
    }),
    async execute(_id, params, ctx) {
      killSubagent(ctx, params.id, params.force);
      
      return {
        content: [{ type: "text", text: `Subagent ${params.id} killed` }],
        details: { id: params.id, killed: true },
      };
    },
  });

  pi.registerTool({
    name: "list_subagents",
    label: "List Subagents",
    description: "List all subagents and their status",
    parameters: Type.Object({
      status: Type.Optional(Type.String({ description: "Filter by status" })),
    }),
    async execute(_id, params) {
      let subagents = Array.from(agents.values());
      
      if (params.status) {
        subagents = subagents.filter(a => a.status === params.status);
      }

      if (subagents.length === 0) {
        return {
          content: [{ type: "text", text: "No subagents found" }],
          details: { count: 0 },
        };
      }

      let list = "## Subagents\n\n";
      for (const agent of subagents) {
        const duration = Math.round((Date.now() - agent.startTime) / 1000);
        const statusIcon = agent.status === "running" ? "⏳" : 
                          agent.status === "completed" ? "✅" : 
                          agent.status === "failed" ? "❌" : 
                          agent.status === "killed" ? "⚡" : "📋";
        
        list += `${statusIcon} **${agent.name}** (${agent.id})\n`;
        list += `   Status: ${agent.status}\n`;
        list += `   Progress: ${agent.progress}%\n`;
        list += `   Running for: ${duration}s\n`;
        if (agent.message) list += `   Message: ${agent.message}\n`;
        list += "\n";
      }

      return {
        content: [{ type: "text", text: list }],
        details: { count: subagents.length },
      };
    },
  });

  // Register commands
  pi.registerCommand("subagents", {
    description: "List all active subagents",
    handler: async (args, ctx) => {
      const running = Array.from(agents.values()).filter(a => 
        a.status === "running" || a.status === "paused"
      ).length;
      const completed = Array.from(agents.values()).filter(a => 
        a.status === "completed"
      ).length;
      const failed = Array.from(agents.values()).filter(a => 
        a.status === "failed"
      ).length;

      if (agents.size === 0) {
        ctx.ui.notify("No subagents found", "info");
        return;
      }

      let list = "## Subagents\n\n";
      list += `**Summary**: ${running} running, ${completed} completed, ${failed} failed\n\n`;
      
      for (const agent of agents.values()) {
        const duration = Math.round((Date.now() - agent.startTime) / 1000);
        const statusIcon = agent.status === "running" ? "⏳" : 
                          agent.status === "completed" ? "✅" : 
                          agent.status === "failed" ? "❌" : 
                          agent.status === "killed" ? "⚡" : "📋";
        
        list += `${statusIcon} **${agent.name}** (${agent.id})\n`;
        list += `   Status: ${agent.status}\n`;
        list += `   Progress: ${agent.progress}%\n`;
        list += `   Running for: ${duration}s\n`;
        if (agent.message) list += `   Message: ${agent.message}\n`;
        if (agent.result) list += `   Result: ${agent.result.substring(0, 100)}...\n`;
        list += "\n";
      }

      ctx.ui.notify(list, "info");
    },
  });

  pi.registerCommand("subagent-kill", {
    description: "Kill a subagent",
    handler: async (args, ctx) => {
      const id = args?.trim();
      if (!id) {
        ctx.ui.notify("Usage: /subagent-kill <subagent-id>", "error");
        return;
      }

      killSubagent(ctx, id, false);
    },
  });

  pi.registerCommand("subagent-kill-all", {
    description: "Kill all running subagents",
    handler: async (_args, ctx) => {
      const running = Array.from(agents.values()).filter(a => 
        a.status === "running" || a.status === "paused"
      );

      if (running.length === 0) {
        ctx.ui.notify("No running subagents to kill", "info");
        return;
      }

      for (const agent of running) {
        killSubagent(ctx, agent.id, true);
      }

      ctx.ui.notify(`Killed ${running.length} subagents`, "warning");
    },
  });

  pi.registerCommand("subagent-stats", {
    description: "Show subagent statistics",
    handler: async (_args, ctx) => {
      const total = agents.size;
      const running = Array.from(agents.values()).filter(a => 
        a.status === "running" || a.status === "paused"
      ).length;
      const completed = Array.from(agents.values()).filter(a => 
        a.status === "completed"
      ).length;
      const failed = Array.from(agents.values()).filter(a => 
        a.status === "failed"
      ).length;

      const totalDuration = Array.from(agents.values())
        .filter(a => a.endTime)
        .reduce((sum, a) => sum + (a.endTime! - a.startTime), 0);
      const avgDuration = completed > 0 
        ? Math.round(totalDuration / completed / 1000) 
        : 0;

      let stats = "## Subagent Statistics\n\n";
      stats += `**Total agents**: ${total}\n`;
      stats += `**Running**: ${running}\n`;
      stats += `**Completed**: ${completed}\n`;
      stats += `**Failed**: ${failed}\n`;
      stats += `**Success rate**: ${completed > 0 ? Math.round((completed / (completed + failed)) * 100) : 0}%\n`;
      stats += `**Average duration**: ${avgDuration}s\n`;

      ctx.ui.notify(stats, "info");
    },
  });

  // Cleanup on shutdown
  pi.on("session_shutdown", () => {
    active = false;
    for (const [id, instance] of agents) {
      if (instance.timeout) {
        clearTimeout(instance.timeout);
      }
      instance.process.kill("SIGTERM");
    }
    agents.clear();
  });

  // Update status bar on agent events
  pi.on("turn_start", async (_event, ctx) => {
    const running = Array.from(agents.values()).filter(a => 
      a.status === "running" || a.status === "paused"
    ).length;

    if (running > 0 && ctx.ui?.setWidget) {
      // Create widget content directly instead of getting existing
      const widgetContent = ["", "", `🤖 ${running} subagent${running !== 1 ? "s" : ""} active`];
      try {
        ctx.ui.setWidget("status", widgetContent);
      } catch (e) {
        // Silently fail
      }
    }
  });

  return {
    spawnSubagent,
    executeTask,
    killSubagent,
    getAgents: () => agents,
  };
}
