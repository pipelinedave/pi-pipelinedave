# OpenViking Integration - Quick Reference

## ✅ Status: Ready to Use

OpenViking is now integrated into pi.dev! The server is running and the extension is loaded.

## 🛠️ Tools Available to LLM

| Tool | Purpose | Example |
|------|---------|---------|
| `viking_search` | Semantic search across all context | "Search for PostgreSQL optimization tips" |
| `viking_list_context` | Browse context filesystem | "List all resources in OpenViking" |
| `viking_read_context` | Read specific context items | "Read the context at /memories/project-x" |
| `viking_commit_session` | Save current session to memory | "Commit this session to OpenViking" |

## 💬 Commands

| Command | Description |
|---------|-------------|
| `/viking-status` | Check connection and session count |
| `/viking-search <query>` | Quick search from command line |
| `/viking-import <path> [type]` | Import files as context |

## 📊 What OpenViking Stores

- **Memories**: Extracted knowledge from conversations (8 categories)
- **Resources**: Imported documents, code, documentation
- **Skills**: Tool definitions and usage patterns
- **Sessions**: Compressed conversation history with L0/L1/L2 layers

## 🔄 Workflow

1. **Work** in pi.dev as normal
2. **Commit** important sessions: "Commit this session to OpenViking"
3. **Search** later: "Search OpenViking for what we learned about X"
4. **Import** docs: `/viking-import ./docs/api.md resource`
5. **Retrieve** context automatically when needed

## 🎯 Use Cases

- **Persistent Memory**: Remember project decisions across sessions
- **Documentation Search**: Search imported docs semantically
- **Cross-Session Learning**: Build knowledge base over time
- **Context Recovery**: Retrieve specific past conversations
- **Team Knowledge**: Share context database across team (HTTP mode)

## 🔧 Configuration

- **Server**: http://localhost:1933
- **Workspace**: /home/dhallmann/openviking-workspace
- **Extension**: ~/.pi/agent/extensions/openviking-integration.ts

## 📚 Learn More

- Full docs: `~/.pi/agent/extensions/OPENVIKING-README.md`
- OpenViking docs: https://openviking.ai/docs
- GitHub: https://github.com/volcengine/OpenViking

## 🚀 Quick Test

```
/viking-status
```

Should show: ✅ Connected to OpenViking with session count

---

**Extension loaded and ready!** Just start using pi.dev normally and ask the LLM to search or commit to OpenViking.
