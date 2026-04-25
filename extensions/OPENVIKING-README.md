# OpenViking Integration for pi.dev

This extension integrates **OpenViking** (the context database for AI Agents) into pi.dev, giving you access to unified context management, semantic search, and session memory capabilities.

## What is OpenViking?

OpenViking is an open-source context database designed specifically for AI Agents. It provides:

- **Filesystem Paradigm**: Unified management of memories, resources, and skills organized like a file system
- **Tiered Context Layers**: L0/L1/L2 structure for progressive content loading (saves tokens)
- **Semantic Search**: Hierarchical retrieval with intent analysis and reranking
- **Session Management**: Automatic compression and memory extraction from conversations
- **Observable Context**: Visualized retrieval trajectories for debugging

## Installation

### 1. Install OpenViking

```bash
pip install openviking --upgrade --force-reinstall
```

### 2. Start OpenViking Server

```bash
# Use your existing workspace
openviking-server start --path /home/dhallmann/openviking-workspace

# Or start with default path
openviking-server start
```

The server will run on `http://localhost:1933` by default.

### 3. Verify Integration

```bash
# Check if OpenViking is running
openviking-server doctor

# In pi.dev, use the command
/viking-status
```

## Available Tools

The extension registers the following tools that the LLM can use:

### `viking_search`
Search the OpenViking context database for relevant memories, resources, and skills.

**Parameters:**
- `query` (required): Search query
- `limit` (optional): Maximum results (default: 10)
- `contextUri` (optional): Search within specific context URI

**Example:**
```
Search for "how to configure PostgreSQL" in OpenViking context
```

### `viking_list_context`
List context directories and files in OpenViking.

**Parameters:**
- `path` (optional): Path to list (default: root)

**Example:**
```
List all contexts in OpenViking
```

### `viking_read_context`
Read specific context content with layered detail (L0/L1/L2).

**Parameters:**
- `path` (required): URI or path to context item
- `layer` (optional): Specific layer (L0, L1, L2)

**Example:**
```
Read context at /resources/postgresql-config
```

### `viking_commit_session`
Commit current conversation to OpenViking as long-term memory.

**Parameters:**
- `sessionId` (optional): Session ID (defaults to current)

**Example:**
```
Commit this session to OpenViking memory
```

## Available Commands

### `/viking-status`
Check OpenViking connection status and session count.

### `/viking-search <query>`
Quick search from the command line.

```bash
/viking-search how to use docker
```

### `/viking-import <path> [type]`
Import files/directories as context (resource, memory, or skill).

```bash
/viking-import ./docs/api.md resource
```

## Usage Examples

### Example 1: Search for Previous Work
```
I worked on a PostgreSQL optimization last week. Search OpenViking for the details.
```

### Example 2: Build on Past Sessions
```
Before we start this new feature, let me commit the current session to memory, then search for related context.
```

### Example 3: Import Documentation
```
Import this API documentation into OpenViking so I can reference it later.
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    pi.dev Agent                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  OpenViking Integration Extension               │   │
│  │  - viking_search tool                           │   │
│  │  - viking_list_context tool                     │   │
│  │  - viking_read_context tool                     │   │
│  │  - viking_commit_session tool                   │   │
│  │  - /viking-status command                       │   │
│  │  - /viking-search command                       │   │
│  │  - /viking-import command                       │   │
│  └───────────────────┬─────────────────────────────┘   │
│                      │ HTTP API                         │
└──────────────────────┼──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              OpenViking Server (localhost:1933)         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Retrieve   │  │   Session   │  │    FS       │    │
│  │  Service    │  │  Service    │  │  Service    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                      │                                  │
│              ┌───────▼───────┐                          │
│              │  Dual Storage │                          │
│              │  AGFS + Vector│                          │
│              └───────────────┘                          │
└─────────────────────────────────────────────────────────┘
```

## Configuration

The extension connects to OpenViking server at:
- **URL**: `http://localhost:1933`
- **Workspace**: `/home/dhallmann/openviking-workspace`

To change the workspace path, edit the extension file:
```typescript
let vikingPath: string = "/path/to/your/workspace";
```

## Troubleshooting

### OpenViking Server Not Running
```bash
# Start the server
openviking-server start --path /home/dhallmann/openviking-workspace

# Check status
openviking-server doctor
```

### Connection Refused
```bash
# Verify server is running
curl http://localhost:1933/api/v1/health

# Check port
lsof -i :1933
```

### No Results from Search
- Ensure you've imported context or committed sessions
- Try broader search queries
- Check OpenViking logs for errors

## Learning Resources

- [OpenViking GitHub](https://github.com/volcengine/OpenViking)
- [OpenViking Documentation](https://openviking.ai/docs)
- [OpenViking Architecture](https://github.com/volcengine/OpenViking/blob/main/docs/en/concepts/01-architecture.md)

## Development

To modify the extension:

```bash
# Edit the extension
nano ~/.pi/agent/extensions/openviking-integration.ts

# Reload in pi.dev
/reload
```

## Future Enhancements

- [ ] Direct Python SDK integration (no HTTP server required)
- [ ] Context import/export tools
- [ ] Memory visualization
- [ ] Custom retrieval strategies
- [ ] Multi-tenant support
- [ ] Encryption at rest

## License

This extension is part of your personal pi.dev setup. OpenViking is licensed under AGPL-3.0.
