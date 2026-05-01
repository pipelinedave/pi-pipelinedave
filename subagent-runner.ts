#!/usr/bin/env node
/**
 * Subagent Runner
 * 
 * This script is executed as a child process when spawning a subagent.
 * It implements the JSON-RPC protocol and executes tasks independently.
 */

import { createInterface } from "node:readline";
import * as fs from "node:fs/promises";
import * as path from "node:path";

interface SessionData {
  id: string;
  name: string;
  task: string;
  context?: string[];
  parentPid: number;
  startTime: number;
}

// Parse command line arguments
const args = process.argv.slice(2);
const sessionFile = args.find(a => a.includes("session-file")) 
  ? args[args.indexOf("session-file") + 1]
  : "/tmp/pi-subagent-default.jsonl";

// Load session data
let session: SessionData;
try {
  const data = await fs.readFile(sessionFile, "utf-8");
  session = JSON.parse(data);
} catch (err) {
  console.error(`Failed to load session file: ${err}`);
  process.exit(1);
}

console.log(`[Subagent ${session.id}] Starting...`);
console.log(`[Subagent ${session.id}] Task: ${session.task}`);

// Simple JSON-RPC message handler
const pendingRequests = new Map();

function sendResponse(id: number | string, result: any): void {
  const response = {
    jsonrpc: "2.0" as const,
    id,
    result,
  };
  process.stdout.write(JSON.stringify(response) + "\n");
}

function sendError(id: number | string, code: number, message: string): void {
  const response = {
    jsonrpc: "2.0" as const,
    id,
    error: { code, message },
  };
  process.stdout.write(JSON.stringify(response) + "\n");
}

function sendProgress(progress: number, message: string): void {
  const response = {
    jsonrpc: "2.0" as const,
    id: "progress",
    result: {
      status: "running",
      progress,
      message,
      timestamp: Date.now(),
    },
  };
  process.stdout.write(JSON.stringify(response) + "\n");
}

// Execute the task
async function executeTask(task: string, context?: string[]): Promise<string> {
  const startTime = Date.now();
  
  // Simulate task execution with progress updates
  const steps = task.split(".").filter(s => s.trim()).length || 3;
  
  for (let i = 1; i <= steps; i++) {
    const progress = Math.round((i / steps) * 100);
    sendProgress(progress, `Processing step ${i}/${steps}`);
    
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`[Subagent ${session.id}] Step ${i}/${steps} completed`);
  }

  const duration = Date.now() - startTime;
  return `Task completed successfully in ${duration}ms. Task: ${task}`;
}

// Handle incoming messages
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", async (line) => {
  if (!line.trim()) return;

  try {
    const msg = JSON.parse(line);
    
    if (msg.jsonrpc !== "2.0") {
      sendError(msg.id, -32700, "Invalid JSON-RPC version");
      return;
    }

    switch (msg.method) {
      case "execute": {
        const { task, context, timeout } = msg.params;
        
        // Set up timeout
        const timeoutId = setTimeout(() => {
          sendError(msg.id, -32001, "Task timed out");
          process.exit(1);
        }, timeout || 300000);

        try {
          const result = await executeTask(task, context);
          clearTimeout(timeoutId);
          
          sendResponse(msg.id, {
            status: "completed",
            progress: 100,
            result,
            duration: Date.now() - session.startTime,
          });
        } catch (err: any) {
          clearTimeout(timeoutId);
          sendResponse(msg.id, {
            status: "failed",
            progress: 0,
            error: err.message,
          });
        }
        break;
      }

      case "status": {
        sendResponse(msg.id, {
          status: "running",
          progress: 50,
          message: "Task in progress",
        });
        break;
      }

      case "kill": {
        console.log(`[Subagent ${session.id}] Kill signal received`);
        sendResponse(msg.id, {
          status: "killed",
          progress: 0,
          message: "Process killed",
        });
        process.exit(0);
      }

      case "ping": {
        sendResponse(msg.id, {
          status: "running",
          progress: 0,
          message: "pong",
        });
        break;
      }

      default:
        sendError(msg.id, -32601, `Method not found: ${msg.method}`);
    }
  } catch (err: any) {
    console.error(`[Subagent ${session.id}] Error processing message: ${err.message}`);
  }
});

// Handle process signals
process.on("SIGTERM", () => {
  console.log(`[Subagent ${session.id}] SIGTERM received`);
  sendProgress(0, "Shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log(`[Subagent ${session.id}] SIGINT received`);
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  console.error(`[Subagent ${session.id}] Uncaught exception: ${err.message}`);
  process.exit(1);
});

console.log(`[Subagent ${session.id}] Ready and waiting for commands`);
