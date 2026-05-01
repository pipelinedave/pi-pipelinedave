# 🤖 pi-pipelinedave - Ultimate AI Coding Setup

> **Your personal AI coding powerhouse with 94+ tools, custom extensions, and cyberpunk aesthetics**

![Status](https://img.shields.io/badge/Status-Operational-success)
![Tools](https://img.shields.io/badge/MCP%20Tools-94%2B-blue)
![Extensions](https://img.shields.io/badge/Custom%20Extensions-9-purple)
![Theme](https://img.shields.io/badge/Theme-Cyberpunk-pink)

## 🚀 Quick Start

```bash
# Start pi with your setup
pi

# Enable cyberpunk theme (already set in settings.json)
# The theme loads automatically on startup
```

## 🎯 What Makes This Special

### **94+ MCP Tools** (7-9x default)
- **Filesystem** (14 tools): Read/write, search, directory tree
- **Docker** (19 tools): Full container lifecycle management
- **Kubernetes** (23 tools): kubectl, Helm, cluster operations
- **Chrome DevTools** (29 tools): Browser automation, performance, debugging
- **Plus**: SQLite, Time, Brave Search, Memory tools

### **10 Custom Extensions**
1. **unified-status.ts** ⭐ - Ultra-cool cyberpunk status bar
2. **mcp-bridge.ts** - MCP server integration
3. **plan-mode.ts** - Structured workflow management
4. **git-tools.ts** - Auto-stash/checkpoint system
5. **tmux-manager.ts** - Background task control
6. **commit.ts** - Commit message generation
7. **notifications.ts** - Desktop notifications
8. **session-stats.ts** - Analytics
9. **quick-summary.ts** - Session summaries
10. **terminal-title.ts** - Auto-updating terminal window titles

### **4 Custom Skills**
- **code-review**: Automated security & quality reviews
- **web-search**: Brave Search integration
- **tmux**: Background task workflows
- **smart-assistant**: Prompt enhancement

### **Cyberpunk Theme** 🌃
Neon pink/cyan dark theme for that futuristic coding vibe

## 📊 Status Bar Features

The **status-bar.ts** extension provides:

- **Real-time mode indicator**: Chat, Plan, Build, Review modes
- **Activity tracking**: Thinking, tool execution, API calls
- **Token usage**: Live token count with formatting
- **Turn counter**: Track conversation turns
- **Git status**: Changed files count
- **Tmux sessions**: Active background sessions
- **Tool execution timer**: Shows running tool with duration
- **Animated box**: Cyberpunk-styled status container

### Status Bar States

```
╭──────────────────────────────────────────────────╮
│ 💬 CHAT │ ⚡ thinking │ 45,230📊 12🔄 3📂 2🖥️    │
╰──────────────────────────────────────────────────╯
```

**Mode indicators:**
- 💬 CHAT - Normal conversation
- 📋 PLAN - Planning mode (PLAN.md detected)
- 🔨 BUILD - Building/writing code
- 👀 REVIEW - Code review mode

**Activity indicators:**
- ⚡ thinking - AI processing
- 🔧 tool (duration) - Tool execution with timer
- 🌐 api - Network request in progress
- ✓ - Action complete

## 🖥️ Terminal Title Automation

The **terminal-title.ts** extension automatically updates your terminal window/tab title:

```
pi.dev: CHAT | ~/projects/my-app
pi.dev: PLAN | 2/5 steps | ~/projects/my-app
pi.dev: BUILD | Write File (3s) | ~/projects/my-app
pi.dev: TOOL | Bash command | ~/projects/my-app
```

**Benefits:**
- ✅ No manual title changes needed
- ✅ See current activity at a glance
- ✅ Easy to distinguish multiple terminal sessions
- ✅ Works in all modern terminals (iTerm2, GNOME Terminal, Windows Terminal, VS Code, etc.)

**Configuration:**
```json
{
  "terminalTitle": {
    "enabled": true
  }
}
```

## 🎮 Commands & Workflows

### Plan Mode
```bash
/plan start      # Enable plan mode
/plan add <step> # Add workflow step
/plan done       # Mark step complete
/plan status     # Show progress
/plan stop       # Disable plan mode
```

### Git Safety Net
```bash
/git-checkpoint "Before refactoring"  # Create stash
/git-restore                          # Restore stashed changes
/git-branch <name>                    # Create new branch
```

### Tmux Management
```bash
/tmux new build "npm run build"       # Start background session
/tmux attach build                    # Attach to session
/tmux capture build                   # Capture output
/tmux kill build                      # Kill session
/tmux list                            # List all sessions
```

### Session Commands
```bash
/session-stats   # Show session statistics
/context         # Show loaded context
/summary         # Generate session summary
/commit          # Generate commit message
```

## 🛠️ Extension Details

### unified-status.ts
**The crown jewel** - A real-time status bar that:
- Auto-detects mode based on files (PLAN.md → plan mode)
- Tracks tool execution with live duration timer
- Shows git changes, tmux sessions, tokens, turns
- Beautiful cyberpunk box styling
- Updates on every agent event

### mcp-bridge.ts
Integrates 8 MCP servers providing 94+ tools for:
- File operations
- Docker/K8s management
- Browser automation
- Database access
- Web search
- Memory/knowledge

### git-tools.ts
Automatic git safety:
- Auto-stash on pi start
- Auto-restore on pi exit
- Manual checkpoints
- Branch creation helpers

### tmux-manager.ts
Background task management:
- Create, attach, kill sessions
- Send commands to running sessions
- Capture output
- Perfect for long-running builds/tests

## 📁 File Structure

```
~/.pi/agent/
├── README.md                 # This file
├── SETUP-SUMMARY.md          # Setup documentation
├── ENHANCEMENT-PLAN.md       # Planned improvements
├── TUI-ENHANCEMENTS.md       # TUI feature docs
├── settings.json             # Theme & provider config
├── models.json               # Model definitions
├── auth.json                 # API credentials (gitignored)
├── bin/
│   └── fd                    # Fast find utility
├── extensions/
│   ├── status-bar.ts         # ⭐ Cyberpunk status bar
│   ├── terminal-title.ts     # Auto-updating terminal titles
│   ├── mcp-bridge.ts         # MCP integration
│   ├── plan-mode.ts          # Workflow management
│   ├── git-tools.ts          # Git automation
│   ├── tmux-manager.ts       # Tmux control
│   ├── commit.ts             # Commit messages
│   ├── notifications.ts      # Desktop notifications
│   ├── session-stats.ts      # Analytics
│   ├── quick-summary.ts      # Summaries
│   └── ... (setup scripts)
├── skills/
│   ├── code-review/
│   ├── web-search/
│   ├── tmux/
│   └── smart-assistant/
└── themes/
    └── cyberpunk.json        # Neon theme
```

## 🎨 Theme Customization

The cyberpunk theme uses:
- **Primary**: Neon pink (#ff00ff)
- **Secondary**: Cyan (#00ffff)
- **Background**: Dark (#0d0d0d)
- **Accent**: Purple (#9d00ff)

Edit `themes/cyberpunk.json` to customize colors.

## 📈 Performance

- **File operations**: 0.04ms (native Node.js)
- **MCP tools**: ~2-5s (includes LLM decision time)
- **Server startup**: Parallel (all servers start simultaneously)
- **Connection pooling**: Persistent connections

## 🔐 Security

- MCP servers run in isolated subprocesses
- Filesystem access limited to configured directories
- Git operations auto-backup before changes
- Secrets excluded via .gitignore

## 🚀 Advanced Workflows

### 1. Background Build Pipeline
```bash
# Start build in background
/tmux new build-server "npm run build:prod"

# Monitor progress
/tmux capture build-server

# Send test command
/tmux send build-server "npm run test"

# Continue working while build runs
```

### 2. Plan-Driven Development
```bash
/plan start
/plan add "Set up project structure"
/plan add "Implement authentication"
/plan add "Add API endpoints"
/plan add "Write tests"
/plan add "Deploy to production"

# Status bar shows 📋 PLAN mode
# Check progress: /plan status
```

### 3. Safe Refactoring
```bash
# Auto-stash protects your work
# Manual checkpoint before big changes
/git-checkpoint "Before major refactoring"

# If something breaks
/git-restore

# Continue working
```

### 4. Code Review Workflow
```bash
# Before committing
Use /skill:code-review to review changes

# Review specific files for issues
"Review src/components/Button.tsx for security issues"
```

## 📚 Documentation

- [Extensions Guide](docs/extensions.md) - 94KB of examples
- [Skills Spec](docs/skills.md) - Standard format
- [Themes Guide](docs/themes.md) - Color customization
- [TUI Components](docs/tui.md) - Custom UI API
- [Settings](docs/settings.md) - Configuration options

## 🛠️ Maintenance

### Reload Extensions
```bash
/reload  # Hot-reload all extensions
```

### Check Status
```bash
/session-stats  # See token usage and tool counts
/context        # View loaded extensions/skills
```

### Update MCP Servers
```bash
/mcp-reload  # Reload all MCP servers
```

## 🎯 Next Steps

### Optional Enhancements
1. **Install more MCP servers**:
   - PostgreSQL/MySQL database access
   - GitHub/GitLab API
   - Redis cache
   - HTTP API testing

2. **Add community skills**:
   - PDF processing
   - Excel/Word documents
   - Data analysis
   - Image processing

3. **Custom extensions**:
   - Project-specific workflows
   - Team conventions
   - Deployment automation

## 💡 Pro Tips

1. **Use plan mode** for complex tasks - keeps you organized
2. **Leverage tmux** for long-running operations
3. **Check session stats** to monitor token usage
4. **Use web search skill** for current information
5. **Run code review** before committing
6. **Auto-stash** protects your work automatically
7. **Custom theme** makes pi look awesome

## 🤝 Contributing

This is a personal setup, but feel free to:
- Fork for your own configuration
- Borrow extensions and skills
- Adapt the status bar for your needs

## 📜 License

MIT - Feel free to use anything here in your own setup!

---

**Status**: ✅ Fully operational with 94+ tools  
**Last Updated**: 2026-05-01  
**Total Setup Time**: ~2 hours  
**Extensions**: 10 custom extensions  
**Skills**: 4 community skills  
**MCP Servers**: 8 servers (94 tools)

---

Enjoy your supercharged pi.dev! 🎉
