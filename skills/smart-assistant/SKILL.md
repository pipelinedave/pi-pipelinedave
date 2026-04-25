---
name: smart-assistant
description: Intelligent prompt enhancement and context-aware assistance. Automatically improves your prompts, suggests optimal tools, and guides you through complex workflows without explicit commands.
---

# Smart Assistant Skill

Your AI companion that understands context, anticipates needs, and enhances your natural language prompts automatically.

## How It Works

The smart assistant operates in the background, continuously analyzing:
- **Your conversation context** - Recent topics, files, and actions
- **Project state** - Git status, tmux sessions, file changes
- **Intent detection** - Recognizing patterns in your requests
- **Tool usage patterns** - Learning what works best

## Automatic Enhancements

### 1. Plan Mode Detection
When you mention:
- "step by step"
- "break this down"
- "multiple steps"
- "implement from scratch"

**Action**: Automatically suggests enabling plan mode to track progress

**Example**:
```
You: "Let me build a complete authentication system from scratch"
→ Smart assistant: "Complex task detected. Enable plan mode?"
→ Auto-adds: /plan start
```

### 2. Git Safety
When you:
- Make code changes
- Write files
- Modify project structure

**Action**: Suggests creating git checkpoint before continuing

**Example**:
```
You: "Update the user model with email verification"
[File written]
→ Smart assistant: "File saved. Create git checkpoint?"
→ Auto-executes: /git-checkpoint auto-save
```

### 3. Background Task Optimization
When you request:
- "start the server"
- "run tests in watch mode"
- "build the project"
- "long-running process"

**Action**: Suggests using tmux for background execution

**Example**:
```
You: "Start the dev server and watch for changes"
→ Smart assistant: "Long-running task detected"
→ Suggests: /tmux new dev-server "npm run dev --watch"
```

### 4. Web Search Activation
When you ask:
- "What's the latest version of..."
- "Search for recent articles about..."
- "Find current best practices for..."

**Action**: Routes to Brave Search MCP tool automatically

**Example**:
```
You: "What's the latest React 19 features in 2026?"
→ Smart assistant: "Time-sensitive query detected"
→ Uses: brave-search MCP tool
```

### 5. Context Enrichment
The assistant automatically adds relevant context:
- Recently edited files
- Current git branch
- Active tmux sessions
- Previous tool usage

**Example**:
```
You: "Add a new endpoint"
→ Enhanced: "Add a new endpoint\n\nContext: Recently worked with:\n- src/api/users.ts\n- src/models/User.ts\n- tests/users.test.ts"
```

## Natural Language Commands

Just type naturally - the assistant handles the rest:

### Instead of:
```
/plan start
/plan add "Set up database"
/tmux new db-migration "npm run migrate"
```

### Just say:
```
"Let me set up the database and run migrations in the background"
```

The assistant will:
1. Enable plan mode
2. Add the step
3. Create tmux session
4. Track progress

## Smart Suggestions Widget

After each turn, the assistant shows relevant suggestions:
- 💾 Git checkpoint if changes exist
- 🖥️ Tmux session status
- 📝 Code review reminders
- 🔍 Web search opportunities

## Manual Analysis

Use `/analyze` to see current context:
```
/analyze
```

Shows:
- Git status
- Active tmux sessions
- Recent tools used
- Smart suggestions

## Configuration

### Toggle Smart Features
```bash
/copilot on          # Enable all enhancements
/copilot off         # Disable auto-enhancement
/copilot status      # Check current status
```

### Default: ON
Smart features are enabled by default for maximum assistance.

## Intent Recognition

The assistant recognizes these patterns automatically:

### Development Workflows
- "implement feature" → Plan mode + step tracking
- "refactor code" → Code review suggestion
- "add tests" → Test framework detection
- "optimize performance" → Performance tools

### Operations
- "deploy" → Docker/K8s tool selection
- "monitor logs" → Tmux + log tailing
- "backup database" → SQLite/Docker tools
- "scale application" → K8s scaling tools

### Research
- "look up documentation" → Web search
- "find examples" → Web search + code extraction
- "compare technologies" → Multi-result search
- "check latest release" → Time-sensitive search

### Maintenance
- "clean up code" → Code review + refactoring
- "update dependencies" → Package manager tools
- "fix bugs" → Debugging workflow
- "review PR" → Code review skill

## Context Memory

The assistant remembers:
- Last 10 files edited
- Recent tools used
- Current project state
- Active workflows
- Git status
- Tmux sessions

This context is automatically injected into your prompts for better responses.

## Pro Tips

### 1. Be Natural
Just type what you want. The assistant figures out the rest.

### 2. Use Vague to Specific
Start broad: "Build an API"
Then refine: "Add authentication to it"

### 3. Trust the Suggestions
When the assistant suggests tools or workflows, they're context-aware.

### 4. Check Analysis
Run `/analyze` periodically to see what the assistant knows about your context.

### 5. Combine Commands
Natural language + explicit commands = best results
```
"Set up a background build server"
/tmux new build "npm run build --watch"
```

## Example Sessions

### Session 1: New Feature
```
You: "I need to add user authentication"
→ Assistant: "Complex task. Enable plan mode?" [Yes]
→ /plan start
→ /plan add "Design auth schema"
→ /plan add "Implement JWT tokens"
→ /plan add "Add middleware"
→ /plan add "Write tests"
```

### Session 2: Bug Fix
```
You: "Fix the login bug"
→ Assistant: "Detected code review needed"
→ /skill:code-review src/auth/login.ts
→ [Review results]
→ Assistant: "Create checkpoint before fixing?" [Yes]
→ /git-checkpoint fix-login-bug
```

### Session 3: Research
```
You: "What's new in TypeScript 5.5?"
→ Assistant: "Time-sensitive query"
→ brave-search "TypeScript 5.5 new features 2026"
→ [Search results]
→ Assistant: "Extract top 3 changes"
→ [Summarized results]
```

### Session 4: DevOps
```
You: "Deploy to staging"
→ Assistant: "Detected deployment workflow"
→ docker build + kubectl apply
→ /tmux new deploy "deploy script"
→ Assistant: "Monitor deployment?" [Yes]
→ /tmux attach deploy
```

## Privacy & Control

- All processing happens locally
- No data sent to external services (except MCP tools you explicitly use)
- You can disable enhancements anytime with `/copilot off`
- Context is session-isolated

## Troubleshooting

**Too many suggestions?**
```bash
/copilot off  # Disable auto-suggestions
```

**Not smart enough?**
```bash
# Be more specific in your prompts
# Run /analyze to see what context is available
# Check that MCP tools are loaded
```

**Wrong tool selected?**
```bash
# The assistant learns from your corrections
# Explicitly state which tool to use next time
```

---

**Auto-detected**: Intelligent prompt enhancement and context awareness
**Status**: Always-on background assistance
**Best for**: Natural workflow, reduced command typing, context awareness
