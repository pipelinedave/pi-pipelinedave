import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { spawn } from "node:child_process";
import { Type } from "typebox";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";

// Fast native filesystem tools (no MCP overhead!)
const fastFilesystemTools = [
  {
    name: "fs_read_file",
    label: "Read File",
    description: "Read file contents instantly using native Node.js",
    parameters: Type.Object({
      path: Type.String({ description: "Path to file" }),
      head: Type.Optional(Type.Number({ description: "First N lines" })),
      tail: Type.Optional(Type.Number({ description: "Last N lines" })),
    }),
    async execute(_id: string, params: any) {
      try {
        let content = await fs.readFile(params.path, "utf-8");
        if (params.head) {
          content = content.split("\n").slice(0, params.head).join("\n");
        } else if (params.tail) {
          content = content.split("\n").slice(-params.tail).join("\n");
        }
        return { content: [{ type: "text", text: content }], details: {} };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true, details: {} };
      }
    },
  },
  {
    name: "fs_list_directory",
    label: "List Directory",
    description: "List directory contents instantly",
    parameters: Type.Object({
      path: Type.String({ description: "Directory path" }),
    }),
    async execute(_id: string, params: any) {
      try {
        const entries = await fs.readdir(params.path, { withFileTypes: true });
        const result = entries.map(e => `${e.isDirectory() ? "[DIR]" : "[FILE]"} ${e.name}`).join("\n");
        return { content: [{ type: "text", text: result }], details: {} };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true, details: {} };
      }
    },
  },
  {
    name: "fs_get_file_info",
    label: "File Info",
    description: "Get file metadata instantly",
    parameters: Type.Object({
      path: Type.String({ description: "File or directory path" }),
    }),
    async execute(_id: string, params: any) {
      try {
        const stat = await fs.stat(params.path);
        const info = {
          path: params.path,
          type: stat.isFile() ? "file" : stat.isDirectory() ? "directory" : "other",
          size: stat.size,
          created: stat.birthtime.toISOString(),
          modified: stat.mtime.toISOString(),
        };
        return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }], details: {} };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true, details: {} };
      }
    },
  },
  {
    name: "fs_search_files",
    label: "Search Files",
    description: "Search for files using glob patterns",
    parameters: Type.Object({
      path: Type.String({ description: "Base directory" }),
      pattern: Type.String({ description: "Glob pattern" }),
    }),
    async execute(_id: string, params: any) {
      try {
        const { glob } = await import("node:fs");
        const results: string[] = [];
        for await (const entry of glob.glob(params.pattern, { cwd: params.path, recursive: true })) {
          results.push(entry);
        }
        return { content: [{ type: "text", text: results.join("\n") || "No matches" }], details: {} };
      } catch (err: any) {
        // Fallback if glob not available
        try {
          const { execSync } = await import("node:child_process");
          const result = execSync(`find ${params.path} -name "${params.pattern}"`, { encoding: "utf-8" });
          return { content: [{ type: "text", text: result.trim() || "No matches" }], details: {} };
        } catch (e: any) {
          return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true, details: {} };
        }
      }
    },
  },
  {
    name: "fs_directory_tree",
    label: "Directory Tree",
    description: "Get recursive directory tree",
    parameters: Type.Object({
      path: Type.String({ description: "Base directory" }),
      depth: Type.Optional(Type.Number({ description: "Max depth", default: 3 })),
    }),
    async execute(_id: string, params: any) {
      try {
        async function buildTree(dir: string, prefix = "", depth = 0): Promise<string> {
          if (params.depth && depth >= params.depth) return "";
          const entries = await fs.readdir(dir, { withFileTypes: true });
          const lines: string[] = [];
          for (const [i, entry] of entries.entries()) {
            const isLast = i === entries.length - 1;
            const connector = isLast ? "└── " : "├── ";
            const nextPrefix = prefix + (isLast ? "    " : "│   ");
            lines.push(`${prefix}${connector}${entry.name}`);
            if (entry.isDirectory()) {
              const sub = await buildTree(path.join(dir, entry.name), nextPrefix, depth + 1);
              if (sub) lines.push(sub);
            }
          }
          return lines.join("\n");
        }
        const tree = await buildTree(params.path);
        return { content: [{ type: "text", text: tree }], details: {} };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true, details: {} };
      }
    },
  },
];

// MCP client for complex servers (Kubernetes, Docker, Chrome)
class MCPClient {
  private process: ReturnType<typeof spawn> | null = null;
  private messageId = 0;
  private pendingRequests = new Map<number, { resolve: (result: unknown) => void; reject: (error: Error) => void }>();
  private buffer = "";
  private initialized = false;
  private tools: Array<{ name: string; description: string; inputSchema: unknown }> = [];
  private initPromise: Promise<void> | null = null;

  constructor(private command: string, private args: string[], private name: string) {}

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      this.process = spawn(this.command, this.args, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
        windowsHide: true,
      });

      this.process.on("error", (err) => reject(new Error(`MCP "${this.name}" failed: ${err.message}`)));

      this.process.stdout?.on("data", (data: Buffer) => {
        this.buffer += data.toString();
        this.processMessages();
      });

      this.process.stderr?.on("data", () => {}); // Suppress all stderr

      const initId = ++this.messageId;
      this.pendingRequests.set(initId, { resolve: () => {}, reject });

      this.send({
        jsonrpc: "2.0",
        id: initId,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          clientInfo: { name: "pi", version: "1.0.0" },
        },
      });

      const timeout = setTimeout(() => {
        if (!this.initialized) reject(new Error(`MCP "${this.name}" timeout`));
      }, 8000);

      const check = setInterval(() => {
        if (this.initialized) {
          clearInterval(check);
          clearTimeout(timeout);
          resolve();
        }
      }, 30);
    });

    return this.initPromise;
  }

  private processMessages() {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        this.handleMessage(msg);
      } catch {}
    }
  }

  private handleMessage(msg: unknown) {
    if (typeof msg !== "object" || msg === null) return;
    const m = msg as { id?: number; method?: string; result?: unknown; error?: unknown };

    if (m.id !== undefined) {
      const pending = this.pendingRequests.get(m.id);
      if (pending) {
        this.pendingRequests.delete(m.id);
        if (m.error) {
          pending.reject(new Error(JSON.stringify(m.error)));
        } else {
          if (m.result && typeof m.result === "object" && "protocolVersion" in m.result) {
            this.initialized = true;
          }
          pending.resolve(m.result);
        }
      }
      return;
    }

    if (m.method === "notifications/initialized") {
      this.initialized = true;
    }
  }

  private send(request: unknown) {
    this.process?.stdin?.write(JSON.stringify(request) + "\n");
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
      const r = result as { tools?: Array<{ name: string; description: string; inputSchema: unknown }> };
      this.tools = r.tools || [];
    } catch {}
    return this.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = await this.request("tools/call", { name, arguments: args });
    const r = result as { content?: Array<{ text?: string }>; isError?: boolean };
    if (r.isError) throw new Error("Tool error");
    return r.content?.map(c => c.text).filter(t => t).join("\n") || "Success";
  }

  shutdown() {
    this.process?.kill("SIGTERM");
    this.process = null;
  }
}

export default function (pi: ExtensionAPI) {
  const servers = new Map<string, MCPClient>();
  const configPath = path.join(process.env.HOME || "", ".config", "opencode", "opencode.json");

  // Register fast native filesystem tools first
  for (const tool of fastFilesystemTools) {
    pi.registerTool(tool as any);
  }

  async function loadMcpServers() {
    let config: { mcp?: Record<string, { type: string; command?: string[]; url?: string }> };
    try {
      config = JSON.parse(fsSync.readFileSync(configPath, "utf-8"));
    } catch {
      return;
    }

    if (!config.mcp) return;

    // Start all servers in parallel with minimal logging
    const promises = Object.entries(config.mcp)
      .filter(([_, cfg]) => cfg.type === "local" && cfg.command)
      .map(async ([name, cfg]) => {
        const client = new MCPClient(cfg.command![0], cfg.command!.slice(1), name);
        try {
          await client.initialize();
          servers.set(name, client);
          const tools = await client.listTools();
          
          for (const tool of tools) {
            pi.registerTool({
              name: `${name}_${tool.name}`,
              label: `${name}: ${tool.name}`,
              description: tool.description || tool.name,
              parameters: (tool.inputSchema as any) || Type.Object({}),
              async execute(_id, params) {
                try {
                  const result = await client.callTool(tool.name, params as Record<string, unknown>);
                  return { content: [{ type: "text", text: result }], details: {} };
                } catch (err: any) {
                  return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true, details: {} };
                }
              },
            });
          }
          return { name, count: tools.length };
        } catch {
          return { name, count: 0 };
        }
      });

    const results = await Promise.all(promises);
    const total = results.reduce((sum, r) => sum + r.count, 0);
    console.log(`MCP: ${results.length} servers, ${total} tools loaded`);
  }

  pi.on("session_start", async (_event, ctx) => {
    // Load MCP servers in background without blocking
    loadMcpServers().then(() => {
      ctx.ui.notify("MCP ready", "success");
    }).catch(() => {
      ctx.ui.notify("MCP failed to load", "error");
    });
  });

  pi.on("session_shutdown", async () => {
    for (const s of servers.values()) s.shutdown();
    servers.clear();
  });
}
