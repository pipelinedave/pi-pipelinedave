#!/usr/bin/env node
/**
 * Subagent Runner (JavaScript version)
 * 
 * This script is executed as a child process when spawning a subagent.
 * It implements the JSON-RPC protocol and executes tasks independently.
 * 
 * IMPORTANT: All logs go to stderr, all JSON-RPC messages go to stdout.
 */

const fs = require('fs');
const readline = require('readline');

// Parse command line arguments
const args = process.argv.slice(2);
const sessionFileIndex = args.indexOf('--session-file');
const sessionFile = sessionFileIndex !== -1 ? args[sessionFileIndex + 1] : '/tmp/pi-subagent-default.jsonl';

// Load session data
let session;
try {
  const data = fs.readFileSync(sessionFile, 'utf-8');
  session = JSON.parse(data);
} catch (err) {
  process.stderr.write(`[Subagent ERROR] Failed to load session file: ${err.message}\n`);
  process.exit(1);
}

// Helper to log to stderr (never stdout - stdout is for JSON-RPC only)
function log(...args) {
  process.stderr.write(`[${session.id}] ${args.join(' ')}\n`);
}

function logError(...args) {
  process.stderr.write(`[${session.id} ERROR] ${args.join(' ')}\n`);
}

// Initialize
log('Starting...');
log(`Task: ${session.task}`);

// JSON-RPC helpers - ALL output to stdout
function sendResponse(id, result) {
  try {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
  } catch (err) {
    logError(`Failed to send response: ${err.message}`);
  }
}

function sendError(id, code, message) {
  try {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");
  } catch (err) {
    logError(`Failed to send error: ${err.message}`);
  }
}

function sendProgress(progress, message) {
  try {
    process.stdout.write(JSON.stringify({
      jsonrpc: "2.0",
      id: "progress",
      result: { status: "running", progress, message, timestamp: Date.now() }
    }) + "\n");
  } catch (err) {
    logError(`Failed to send progress: ${err.message}`);
  }
}

// Execute the task
async function executeTask(task, context) {
  const startTime = Date.now();
  const steps = Math.max(task.split(".").filter(s => s.trim()).length, 3);
  
  for (let i = 1; i <= steps; i++) {
    const progress = Math.round((i / steps) * 100);
    sendProgress(progress, `Processing step ${i}/${steps}`);
    log(`Step ${i}/${steps} completed`);
    
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const duration = Date.now() - startTime;
  return `Task completed successfully in ${duration}ms. Task: ${task}`;
}

// Handle incoming messages
const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

rl.on('line', async (line) => {
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
        log(`Executing task: ${task}`);
        
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
          log('Task completed');
        } catch (err) {
          clearTimeout(timeoutId);
          sendResponse(msg.id, {
            status: "failed",
            progress: 0,
            error: err.message,
          });
          logError(`Task failed: ${err.message}`);
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
        log('Kill signal received');
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
  } catch (err) {
    logError(`Error processing message: ${err.message}`);
  }
});

// Handle process signals
process.on("SIGTERM", () => {
  log('SIGTERM received');
  sendProgress(0, "Shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  log('SIGINT received');
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  logError(`Uncaught exception: ${err.message}`);
  process.exit(1);
});

log('Ready and waiting for commands');
