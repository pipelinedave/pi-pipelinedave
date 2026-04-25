---
name: tmux
description: Manage tmux sessions for background tasks, long-running processes, and terminal multiplexing. Use for running scripts, servers, or commands in the background while maintaining full control.
---

# Tmux Skill

Manage tmux sessions, windows, and panes for background execution and terminal multiplexing.

## Quick Reference

```bash
# Create new session
tmux new-session -s <name>

# List sessions
tmux list-sessions

# Attach to session
tmux attach-session -t <name>

# Detach from session (Ctrl+b, d)
tmux detach-client

# Kill session
tmux kill-session -t <name>
```

## Available Commands

### Start Background Task
```bash
tmux new-session -d -s <session-name> '<command>'
```
Example:
```bash
tmux new-session -d -s build-server 'npm run dev'
```

### Run Command in New Window
```bash
tmux new-window -t <session-name> -n <window-name> '<command>'
```

### Send Keys to Session
```bash
tmux send-keys -t <session-name> '<keys>' Enter
```

### Capture Pane Content
```bash
tmux capture-pane -t <session-name> -p
```

### List All Sessions
```bash
tmux list-sessions
```

### Session Management
- **Create**: `tmux new-session -s <name>`
- **Detach**: `tmux detach` or `Ctrl+b d`
- **Attach**: `tmux attach -t <name>`
- **Kill**: `tmux kill-session -t <name>`
- **Rename**: `tmux rename-session -t <old> <new>`

## Use Cases

### 1. Long-running Development Server
```bash
tmux new-session -d -s dev-server 'npm run dev --port 3000'
```

### 2. Background Build Process
```bash
tmux new-session -d -s build 'npm run build && echo "BUILD COMPLETE"'
tmux attach -t build  # Watch progress
# Detach when done (Ctrl+b d)
```

### 3. Multiple Services
```bash
tmux new-session -d -s microservices
tmux send-keys -t microservices 'docker-compose up' Enter
tmux new-window -t microservices -n logs 'docker-compose logs -f'
tmux new-window -t microservices -n metrics 'kubectl top pods'
```

### 4. Watch File Changes
```bash
tmux new-session -d -s watcher 'watch -n 5 git status'
```

### 5. Run Tests in Background
```bash
tmux new-session -d -s tests 'npm test --watch'
tmux capture-pane -t tests -p  # Check results later
```

## Best Practices

1. **Naming**: Use descriptive session names (`api-server`, `frontend-dev`, `db-migration`)
2. **Detaching**: Always detach cleanly (`Ctrl+b d`) instead of killing
3. **Monitoring**: Use `tmux list-sessions` to track running tasks
4. **Cleanup**: Kill completed sessions to free resources
5. **Logging**: Redirect output to files for long-running tasks

## Common Keybindings

| Key | Action |
|-----|--------|
| `Ctrl+b d` | Detach from session |
| `Ctrl+b s` | List sessions |
| `Ctrl+b w` | List windows |
| `Ctrl+b n` | Next window |
| `Ctrl+b p` | Previous window |
| `Ctrl+b %` | Split pane vertically |
| `Ctrl+b "` | Split pane horizontally |
| `Ctrl+b arrow` | Navigate panes |
| `Ctrl+b x` | Close pane |

## Pi Integration

When using tmux with pi:

1. **Background tasks**: Use tmux for anything that should continue after pi exits
2. **Progress monitoring**: Attach to tmux sessions to watch long operations
3. **Multiple contexts**: Run different services in separate tmux windows
4. **Persistence**: Tmux sessions survive pi restarts and system reboots

## Examples

### Start API Server in Background
```bash
tmux new-session -d -s api 'cd /path/to/api && npm run dev'
```

### Monitor Build Progress
```bash
tmux new-session -d -s build 'make build'
# Later:
tmux attach -t build
```

### Run Multiple Commands
```bash
tmux new-session -d -s multi
tmux send-keys -t multi 'echo "Starting..."' Enter
tmux send-keys -t multi './script.sh' Enter
tmux send-keys -t multi 'echo "Done"' Enter
```

### Watch Logs
```bash
tmux new-session -d -s logs 'tail -f /var/log/app.log'
tmux attach -t logs
```

## Troubleshooting

**Session already exists?**
```bash
tmux list-sessions
tmux attach -t <name>  # Or kill it first
```

**Can't find session?**
```bash
tmux list-sessions
tmux attach  # Attaches to most recent
```

**Zombie processes?**
```bash
tmux kill-server  # Kill all sessions (use carefully!)
```

**Permission issues?**
```bash
# Ensure tmux is installed
which tmux
# Install if needed
sudo apt install tmux  # Debian/Ubuntu
brew install tmux      # macOS
```

## Advanced Features

### Named Pipes for Logging
```bash
tmux new-session -d -s logger 'tail -f app.log > /tmp/session.log'
```

### Auto-restart on Failure
```bash
tmux new-session -d -s resilient 'while true; do ./app.sh; sleep 5; done'
```

### Resource Monitoring
```bash
tmux new-session -d -s monitor 'htop'
```

### Git Operations
```bash
tmux new-session -d -s git-ops 'git pull && npm install && npm run build'
tmux capture-pane -t git-ops -p  # Check output later
```

---

**Auto-detected**: This skill enables background task management via tmux.
**Tools Used**: `tmux` command-line utility
**Requires**: tmux installed on system
