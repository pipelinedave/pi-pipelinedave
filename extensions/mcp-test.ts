import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { spawn } from "node:child_process";
import { Type } from "typebox";

// Simple MCP client for testing
class MCPClient {
  private process: ReturnType<typeof spawn> | null = null;
  private messageId = 0;
  private pendingRequests = new Map<number, { 
    resolve: (result: unknown) => void; 
    reject: (error: Error) => void;
  }>();
  private buffer = "";
  private initialized = false;
  private tools: Array<{ name: string; description: string; inputSchema: unknown }> = [];

  constructor(
    private command: string,
    private args: string[],
    private name: string
  ) {}

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.command, this.args, {
        stdio: ["pipe", "pipe", "inherit"],
        shell: false,
      });

      this.process.on("error", (err) => {
        reject(new Error(`MCP server "${this.name}" failed to start: ${err.message}`));
      });

      this.process.stdout?.on("data", (data: Buffer) => {
        this.buffer += data.toString();
        this.processMessages();
      });

      // Send initialize request
      const initRequest = {
        jsonrpc: "2.0",
        id: ++this.messageId,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
          clientInfo: { name: "pi", version: "1.0.0" },
        },
      };

      this.send(initRequest);

      // Wait for initialization
      const checkInitialized = setInterval(() => {
        if (this.initialized) {
          clearInterval(checkInitialized);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInitialized);
        reject(new Error(`MCP server "${this.name}" initialization timeout`));
      }, 10000);
    });
  }

  private processMessages() {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message = JSON.parse(line);
        this.handleMessage(message);
      } catch (err) {
        console.error(`Failed to parse: ${line.substring(0, 50)}`);
      }
    }
  }

  private handleMessage(message: unknown) {
    if (typeof message !== "object" || message === null) return;
    const msg = message as { id?: number; method?: string; result?: unknown; error?: unknown };

    if (msg.id !== undefined) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(JSON.stringify(msg.error)));
        } else {
          pending.resolve(msg.result);
        }
      }
    }

    if (msg.method === "notifications/initialized") {
      this.initialized = true;
    }
  }

  private send(request: unknown) {
    if (!this.process?.stdin) return;
    this.process.stdin.write(JSON.stringify(request) + "\n");
  }

  async request(method: string, params: unknown = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      this.pendingRequests.set(id, { resolve, reject });
      this.send({ jsonrpc: "2.0", id, method, params });
    });
  }

  async listTools(): Promise<Array<{ name: string; description: string; inputSchema: unknown }>> {
    if (this.tools.length > 0) return this.tools;
    try {
      const result = await this.request("tools/list");
      const toolsResult = result as { tools?: Array<{ name: string; description: string; inputSchema: unknown }> };
      this.tools = toolsResult.tools || [];
      return this.tools;
    } catch (err) {
      console.error(`Failed to list tools: ${err}`);
      return [];
    }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = await this.request("tools/call", { name, arguments: args });
    const callResult = result as { content?: Array<{ text?: string }>; isError?: boolean };
    if (callResult.isError) throw new Error("Tool error");
    return callResult.content?.map(c => c.text).join("\n") || "Success";
  }

  shutdown() {
    this.process?.kill("SIGTERM");
  }
}

export default function (pi: ExtensionAPI) {
  let filesystemClient: MCPClient | null = null;

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Starting filesystem MCP server...", "info");

    filesystemClient = new MCPClient("npx", ["-y", "@modelcontextprotocol/server-filesystem", "/home/dhallmann", "/tmp"], "filesystem");

    try {
      await filesystemClient.initialize();
      ctx.ui.notify("Filesystem MCP initialized", "success");

      const tools = await filesystemClient.listTools();
      ctx.ui.notify(`Found ${tools.length} tools`, "info");

      for (const tool of tools) {
        pi.registerTool({
          name: `fs_${tool.name}`,
          label: `FS: ${tool.name}`,
          description: tool.description || tool.name,
          parameters: (tool.inputSchema as any) || Type.Object({}),
          async execute(_id, params) {
            try {
              const result = await filesystemClient!.callTool(tool.name, params as Record<string, unknown>);
              return { content: [{ type: "text", text: result }], details: {} };
            } catch (err) {
              return { content: [{ type: "text", text: `Error: ${err}` }], isError: true, details: {} };
            }
          },
        });
      }

      ctx.ui.notify(`Filesystem MCP ready: ${tools.length} tools`, "success");
    } catch (err) {
      ctx.ui.notify(`Failed: ${err}`, "error");
    }
  });

  pi.on("session_shutdown", async () => {
    filesystemClient?.shutdown();
  });
}
