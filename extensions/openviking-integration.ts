/**
 * OpenViking Integration for pi.dev
 * 
 * Integrates OpenViking (context database for AI Agents) into pi.dev
 * 
 * OpenViking provides:
 * - Unified context management (memory, resources, skills) via filesystem paradigm
 * - Tiered context layers (L0/L1/L2) for progressive loading
 * - Semantic search and hierarchical retrieval
 * - Session management and automatic memory compression
 * 
 * This extension exposes OpenViking capabilities as tools and commands for pi.dev
 */

import type { ExtensionAPI, ToolContext } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

// OpenViking client type (will be loaded dynamically)
interface OpenVikingClient {
  search: {
    find: (params: { query: string; limit?: number; contextUri?: string }) => Promise<any>;
  };
  fs: {
    ls: (path: string) => Promise<any>;
    read: (path: string) => Promise<any>;
    mkdir: (path: string) => Promise<any>;
  };
  session: {
    commit: (sessionId: string) => Promise<any>;
    list: () => Promise<any>;
  };
}

let vikingClient: OpenVikingClient | null = null;
let vikingPath: string = "/home/dhallmann/openviking-workspace";
let isInitialized = false;

async function ensureVikingClient(): Promise<OpenVikingClient> {
  if (vikingClient && isInitialized) {
    return vikingClient;
  }

  try {
    // Try to import OpenViking Python via subprocess or use HTTP client
    // For now, we'll use the HTTP API if server is running
    const response = await fetch("http://localhost:1933/health", {
      method: "GET",
    }).catch(() => null);

    if (response?.ok) {
      // HTTP mode - use REST API
      vikingClient = {
        search: {
          find: async (params) => {
            const res = await fetch("http://localhost:1933/api/v1/search/find", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(params),
            });
            return res.json();
          },
        },
        fs: {
          ls: async (path) => {
            const res = await fetch(`http://localhost:1933/api/v1/fs/ls?uri=${encodeURIComponent(path)}`, {
              method: "GET",
            });
            return res.json();
          },
          read: async (path) => {
            const res = await fetch(`http://localhost:1933/api/v1/fs/read?uri=${encodeURIComponent(path)}`, {
              method: "GET",
            });
            return res.json();
          },
          mkdir: async (path) => {
            const res = await fetch("http://localhost:1933/api/v1/fs/mkdir", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ uri: path }),
            });
            return res.json();
          },
        },
        session: {
          commit: async (sessionId) => {
            const res = await fetch(`http://localhost:1933/api/v1/sessions/${sessionId}/commit`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
            return res.json();
          },
          list: async () => {
            const res = await fetch("http://localhost:1933/api/v1/sessions", {
              method: "GET",
            });
            return res.json();
          },
        },
      };
      isInitialized = true;
      return vikingClient;
    }

    throw new Error("OpenViking server not running on localhost:1933");
  } catch (error) {
    console.error("Failed to initialize OpenViking client:", error);
    throw new Error(
      "OpenViking not available. Start the server with: openviking-server start --path /home/dhallmann/openviking-workspace"
    );
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("OpenViking integration loaded", "info");
  });

  // Register OpenViking tools
  pi.registerTool({
    name: "viking_search",
    label: "OpenViking Search",
    description:
      "Search OpenViking context database for relevant memories, resources, and skills. Uses semantic search with hierarchical retrieval. Supports query intent analysis and returns ranked results from L0/L1/L2 context layers.",
    parameters: Type.Object({
      query: Type.String({
        description: "Search query - be specific about what context you need",
      }),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of results (default: 10)",
          default: 10,
        })
      ),
      contextUri: Type.Optional(
        Type.String({
          description: "Specific context URI to search within (optional)",
        })
      ),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      try {
        onUpdate({
          toolCallId,
          content: [
            {
              type: "text",
              text: `🔍 Searching OpenViking for: "${params.query}"...`,
            },
          ],
        });

        const client = await ensureVikingClient();
        const requestBody: any = {
          query: params.query,
          limit: params.limit || 10,
        };
        if (params.contextUri) {
          requestBody.target_uri = params.contextUri;
        }
        const results = await client.search.find(requestBody);

        // Check for errors in response
        if (results.error) {
          return {
            content: [
              {
                type: "text",
                text: `⚠️ Search returned an error: ${results.error.message || JSON.stringify(results.error)}`,
              },
            ],
            details: results,
          };
        }

        const text = formatSearchResults(results);
        return {
          content: [{ type: "text", text }],
          details: results,
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `❌ OpenViking search failed: ${error.message}`,
            },
          ],
          details: {},
        };
      }
    },
  });

  pi.registerTool({
    name: "viking_list_context",
    label: "List OpenViking Context",
    description:
      "List context directories and files in OpenViking. Shows the filesystem structure of memories, resources, and skills organized hierarchically.",
    parameters: Type.Object({
      path: Type.Optional(
        Type.String({
          description: "Path to list (default: root context)",
          default: "/",
        })
      ),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      try {
        onUpdate({
          toolCallId,
          content: [{ type: "text", text: `📁 Listing OpenViking context at: ${params.path}` }],
        });

        const client = await ensureVikingClient();
        const results = await client.fs.ls(params.path || "/");

        const text = formatFileSystemListing(results);
        return {
          content: [{ type: "text", text }],
          details: results,
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Failed to list context: ${error.message}`,
            },
          ],
          details: {},
        };
      }
    },
  });

  pi.registerTool({
    name: "viking_read_context",
    label: "Read OpenViking Context",
    description:
      "Read specific context content from OpenViking. Returns L0/L1/L2 layered content with progressive detail loading.",
    parameters: Type.Object({
      path: Type.String({
        description: "URI or path to the context item to read",
      }),
      layer: Type.Optional(
        Type.String({
          description: "Context layer to read (L0, L1, L2) - defaults to all layers",
          enum: ["L0", "L1", "L2"],
        })
      ),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      try {
        onUpdate({
          toolCallId,
          content: [{ type: "text", text: `📖 Reading OpenViking context: ${params.path}` }],
        });

        const client = await ensureVikingClient();
        const results = await client.fs.read(params.path);

        const text = formatContextContent(results, params.layer);
        return {
          content: [{ type: "text", text }],
          details: results,
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Failed to read context: ${error.message}`,
            },
          ],
          details: {},
        };
      }
    },
  });

  pi.registerTool({
    name: "viking_commit_session",
    label: "Commit Session to OpenViking",
    description:
      "Commit current conversation session to OpenViking as long-term memory. Automatically compresses and extracts memories from the session.",
    parameters: Type.Object({
      sessionId: Type.Optional(
        Type.String({
          description: "Session ID to commit (defaults to current session)",
        })
      ),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      try {
        onUpdate({
          toolCallId,
          content: [{ type: "text", text: "💾 Committing session to OpenViking..." }],
        });

        const client = await ensureVikingClient();
        const results = await client.session.commit(params.sessionId || "current");

        return {
          content: [
            {
              type: "text",
              text: `✅ Session committed successfully!\n\nMemory extracted and stored in OpenViking context database.\nUse viking_search to retrieve this knowledge later.`,
            },
          ],
          details: results,
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Failed to commit session: ${error.message}`,
            },
          ],
          details: {},
        };
      }
    },
  });

  // Register commands
  pi.registerCommand("viking-status", {
    description: "Check OpenViking integration status",
    handler: async (_args, ctx) => {
      try {
        const client = await ensureVikingClient();
        const sessions = await client.session.list();

        // Handle the actual response format: {status: "ok", result: [...], error: null}
        const sessionCount = sessions?.result?.length || sessions?.count || 0;
        const healthy = sessions?.status === "ok" && !sessions?.error;

        ctx.ui.notify("OpenViking Status", healthy ? "info" : "warning", {
          message: `✅ Connected to OpenViking\nSessions: ${sessionCount}\nStatus: ${healthy ? "Healthy" : "Check server logs"}`,
        });
      } catch (error: any) {
        ctx.ui.notify("OpenViking Not Available", "error", {
          message: error.message || "Unknown error occurred",
        });
      }
    },
  });

  pi.registerCommand("viking-search", {
    description: "Search OpenViking context database",
    handler: async (args, ctx) => {
      if (!args) {
        ctx.ui.notify("Usage", "info", { message: "/viking-search <query>" });
        return;
      }

      try {
        ctx.ui.notify("Searching...", "info");
        const client = await ensureVikingClient();
        const results = await client.search.find({ query: args, limit: 5 });

        // Check for errors in response
        if (results.error) {
          ctx.ui.notify("Search Error", "error", {
            message: results.error.message || "Search failed - embedding model may not be configured",
          });
          return;
        }

        const text = formatSearchResults(results);
        ctx.ui.notify("Search Results", "info", { message: text });
      } catch (error: any) {
        ctx.ui.notify("Search Failed", "error", { message: error.message });
      }
    },
  });

  pi.registerCommand("viking-import", {
    description: "Import a file/directory into OpenViking as context",
    handler: async (args, ctx) => {
      if (!args) {
        ctx.ui.notify("Usage", "info", { message: "/viking-import <path> [context-type]" });
        return;
      }

      const [path, type = "resource"] = args.split(" ");

      ctx.ui.notify("Importing...", "info", {
        message: `Importing ${path} as ${type} into OpenViking`,
      });

      // Note: This would need actual OpenViking API support for imports
      ctx.ui.notify("Import Not Implemented", "warning", {
        message:
          "File import requires OpenViking server with resource import endpoints. Use the Python SDK directly for now.",
      });
    },
  });

  // Helper functions for formatting
  function formatSearchResults(results: any): string {
    if (!results || !results.results || results.results.length === 0) {
      return "📭 No results found in OpenViking context database.";
    }

    let output = `🔍 Found ${results.results.length} context items:\n\n`;

    results.results.forEach((item: any, idx: number) => {
      output += `${idx + 1}. **${item.uri || item.path}**\n`;
      output += `   Score: ${(item.score || item.relevance || 0).toFixed(2)}\n`;
      output += `   Type: ${item.type || "unknown"}\n`;
      if (item.summary || item.L1) {
        output += `   Summary: ${(item.summary || item.L1 || "").substring(0, 100)}...\n`;
      }
      output += "\n";
    });

    return output;
  }

  function formatFileSystemListing(results: any): string {
    if (!results || !results.entries) {
      return "📭 Empty or invalid response from OpenViking.";
    }

    let output = `📁 OpenViking Context Structure:\n\n`;

    results.entries.forEach((entry: any) => {
      const icon = entry.type === "directory" ? "📁" : "📄";
      output += `${icon} ${entry.name} (${entry.type})\n`;
      if (entry.path) {
        output += `   Path: ${entry.path}\n`;
      }
    });

    return output;
  }

  function formatContextContent(results: any, layer: string | undefined): string {
    if (!results) {
      return "📭 No content found.";
    }

    let output = `📖 Context Content:\n\n`;

    if (layer) {
      output += `Layer ${layer}:\n`;
      output += results[layer] || results.content || "No content for this layer.\n";
    } else {
      // Show all layers
      ["L0", "L1", "L2"].forEach((l) => {
        if (results[l]) {
          output += `**${l}**:\n${results[l]}\n\n`;
        }
      });
      output += results.content || "";
    }

    return output;
  }
}
