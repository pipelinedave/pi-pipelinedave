/**
 * Subagent Protocol - JSON-RPC 2.0 over stdio
 * 
 * This module defines the message format and serialization for communication
 * between the main pi.dev instance and subagents.
 */

// Export all types and utilities - this is a utility module, not an extension

export interface SubagentRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: "execute" | "status" | "kill" | "ping";
  params: ExecuteParams | StatusParams | KillParams | PingParams;
}

export interface SubagentResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: SubagentResult;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface ExecuteParams {
  task: string;
  context?: string[]; // File paths or context identifiers
  timeout?: number; // milliseconds
  priority?: "low" | "normal" | "high";
  metadata?: Record<string, unknown>;
}

export interface StatusParams {
  id: string;
}

export interface KillParams {
  id: string;
  force?: boolean;
}

export interface PingParams {
  timestamp?: number;
}

export type SubagentStatus = 
  | "pending"
  | "spawning"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "killed"
  | "timeout";

export interface SubagentResult {
  status: SubagentStatus;
  progress: number; // 0-100
  message?: string;
  stdout?: string;
  stderr?: string;
  result?: string;
  error?: string;
  duration?: number; // milliseconds
  metadata?: Record<string, unknown>;
}

export interface SubagentEvent {
  type: "progress" | "complete" | "error" | "log";
  data: SubagentResult | string;
  timestamp: number;
}

/**
 * Message serializer for JSON-RPC 2.0
 * Uses newline-delimited JSON (JSONL) for streaming
 */
export class ProtocolSerializer {
  private buffer = "";

  serialize(message: SubagentRequest | SubagentResponse): string {
    return JSON.stringify(message) + "\n";
  }

  deserialize(chunk: string): (SubagentRequest | SubagentResponse)[] {
    this.buffer += chunk;
    const messages: (SubagentRequest | SubagentResponse)[] = [];
    
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue; // Skip empty lines
      
      // Skip non-JSON lines (like log messages)
      if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
        continue;
      }
      
      try {
        messages.push(JSON.parse(trimmed));
      } catch (err) {
        // Silently skip invalid JSON (could be log messages)
        console.error("Failed to parse JSON-RPC message:", err);
      }
    }

    return messages;
  }

  reset(): void {
    this.buffer = "";
  }
}

/**
 * Message ID generator with collision avoidance
 */
export class MessageIdGenerator {
  private counter = 0;
  private used = new Set<number>();

  generate(): number {
    let id: number;
    do {
      id = ++this.counter;
    } while (this.used.has(id) && this.counter < Number.MAX_SAFE_INTEGER);
    
    this.used.add(id);
    return id;
  }

  markUsed(id: number): void {
    this.used.add(id);
  }

  release(id: number): void {
    this.used.delete(id);
  }

  reset(): void {
    this.counter = 0;
    this.used.clear();
  }
}

/**
 * Protocol validation utilities
 */
export function validateRequest(msg: unknown): msg is SubagentRequest {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as any;
  return (
    m.jsonrpc === "2.0" &&
    (typeof m.id === "number" || typeof m.id === "string") &&
    typeof m.method === "string" &&
    typeof m.params === "object"
  );
}

export function validateResponse(msg: unknown): msg is SubagentResponse {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as any;
  return (
    m.jsonrpc === "2.0" &&
    (typeof m.id === "number" || typeof m.id === "string") &&
    (m.result !== undefined || m.error !== undefined)
  );
}

export function validateResult(result: unknown): result is SubagentResult {
  if (!result || typeof result !== "object") return false;
  const r = result as any;
  return (
    typeof r.status === "string" &&
    typeof r.progress === "number" &&
    r.progress >= 0 &&
    r.progress <= 100
  );
}

/**
 * Error codes for protocol errors
 */
export const ProtocolErrors = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  PROCESS_ERROR: -32000,
  TIMEOUT_ERROR: -32001,
  KILLED_ERROR: -32002,
} as const;

export function createErrorResponse(
  id: number | string,
  code: number,
  message: string,
  data?: unknown
): SubagentResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, data },
  };
}

export function createSuccessResponse(
  id: number | string,
  result: SubagentResult
): SubagentResponse {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}
