# Status Bar Improvement Plan

Based on analysis of popular pi.dev status bar extensions (@feniix/pi-statusline, @nicobailon/pi-powerline-footer, @carlosarraes/pi-statusbar, etc.)

## Current Features ✅
- [x] Mode indicator (💬 CHAT | 📋 PLAN | 🔨 BUILD | 👀 REVIEW)
- [x] Activity indicator (⚡ thinking | 🌐 API | 🔧 tool)
- [x] Token count (📊)
- [x] Turn count (🔄)
- [x] Git changes (📂)
- [x] Tmux sessions (🖥️)
- [x] Plan progress (📋 PLAN • 2/5 steps)
- [x] Right-aligned stats tray
- [x] Single-line footer integration

## Recommended Improvements

### 1. **Model Information** 🎯 HIGH PRIORITY
**What popular extensions show:**
- Current model name (e.g., "qwen-3.5-122b", "claude-3.5")
- Model provider indicator
- Shortened model name for compactness

**Implementation:**
- Display current model in left section
- Show provider emoji (🤖 for general, 🧠 for thinking models)
- Truncate long model names (e.g., "qwen-3.5-122b-sovereign" → "qwen-3.5")

### 2. **Token Usage with Context Window** 🎯 HIGH PRIORITY
**What popular extensions show:**
- Input tokens vs Output tokens separately
- Context window usage percentage
- Color-coded usage (green → yellow → red)
- Smart formatting (1.2k, 45M instead of 1234, 45000000)
- Subscription vs Pay-per-use indicator

**Implementation:**
- Split tokens into 📥 input / 📤 output
- Show context usage: "📊 45K/200K (22%)"
- Color coding based on usage percentage
- Compact number formatting (1.2k, 45M, 1.2B)

### 3. **Cost Tracking** 💰 MEDIUM PRIORITY
**What popular extensions show:**
- Session cost (e.g., "$0.45")
- Daily/monthly cost tracking
- Subscription indicator "(sub)" for unlimited plans
- Provider-specific cost calculation

**Implementation:**
- Add 💰 cost indicator
- Show session cost: "$0.45" or "(sub)" for unlimited
- Optional daily/monthly totals

### 4. **Git Branch & Status** 🎯 HIGH PRIORITY
**What popular extensions show:**
- Current git branch (e.g., "main", "feature/x")
- Detailed git status: modified/staged/untracked counts
- Branch name with color coding
- Dirty worktree indicator

**Implementation:**
- Show branch: "📂 main" or "📂 feat/new-feature"
- Git diff stats: "📂 ~3 +5 -2" (modified, added, deleted)
- Worktree status indicator

### 5. **Working Directory** 📁 MEDIUM PRIORITY
**What popular extensions show:**
- Current folder name (basename only)
- Project root indicator
- Relative path from home

**Implementation:**
- Show current directory: "~/projects/pi" or just "pi"
- Optional full path toggle

### 6. **Thinking/Reasoning Level** 🧠 MEDIUM PRIORITY
**What popular extensions show:**
- Thinking mode indicator
- Reasoning depth level
- "Deep thinking" vs "Quick response"

**Implementation:**
- Show thinking level: "🧠 deep" or "⚡ fast"
- Indicator for reasoning models

### 7. **Session Duration** ⏱️ LOW PRIORITY
**What popular extensions show:**
- Time since session start
- Active time tracking
- "Working for 2h 34m"

**Implementation:**
- Add ⏱️ duration: "2h 34m"
- Only show after first hour

### 8. **Skill/Extension Status** 🔌 LOW PRIORITY
**What popular extensions show:**
- Active skills count
- Running extensions
- Skill-specific indicators

**Implementation:**
- Show active skills: "🔌 3"
- Running subagents count

### 9. **Weather/Time** 🌤️ OPTIONAL
**What some extensions show:**
- Current time
- Weather (location-based)
- Calendar events

**Implementation:**
- Optional clock: "🕐 14:32"
- Weather integration (requires API)

### 10. **Compact/Expanded Modes** 🎛️ MEDIUM PRIORITY
**What popular extensions show:**
- Toggle between compact and detailed views
- Auto-compact when terminal is narrow
- Customizable layout

**Implementation:**
- Auto-compact based on terminal width
- `/status compact` command to toggle
- Preserve essential info in compact mode

## Priority Implementation Plan

### Phase 1: Essential Enhancements (Week 1)
1. **Model Information** - Show current model name
2. **Git Branch** - Display current branch
3. **Token Context** - Show input/output separately with context window
4. **Smart Number Formatting** - 1.2k, 45M instead of raw numbers

### Phase 2: Advanced Features (Week 2)
5. **Cost Tracking** - Session cost and subscription indicator
6. **Detailed Git Status** - Modified/staged/untracked counts
7. **Working Directory** - Current folder name
8. **Color Coding** - Usage-based color changes

### Phase 3: Polish & Customization (Week 3)
9. **Compact Mode** - Auto-compact for narrow terminals
10. **Thinking Level** - Reasoning depth indicator
11. **Session Duration** - Time tracking
12. **Customizable Layout** - User configuration options

## Example Layouts

### Current Layout
```
│ 💬 CHAT • ⚡  │  📊 40,450  🔄 5  📂 3  🖥️ 2 │
```

### Proposed Layout (Phase 1)
```
│ 💬 qwen-3.5 • 🧠 deep • main  │  📥 25K 📤 15K/200K  🔄 5  📂 ~3 │
```

### Proposed Layout (Phase 2 - Full)
```
│ 💬 qwen-3.5 • main* • 🧠 deep  │  📥 25K 📤 15K ($0.45)  🔄 5  📂 ~3 +5-2 │
```

### Compact Layout (Narrow Terminal)
```
│ 💬 qwen-3.5 • main  │  📊 40K  🔄 5  📂 3 │
```

## Technical Considerations

### Performance
- Cache git status updates (watcher or debounced)
- Limit API calls for cost calculation
- Debounce frequent updates (max 10/sec)

### Configuration
```json
{
  "statusBar": {
    "showModel": true,
    "showCost": true,
    "showGitBranch": true,
    "showThinking": true,
    "compactMode": "auto",
    "colorCoding": true
  }
}
```

### Compatibility
- Graceful degradation if data unavailable
- Fallback for providers without cost data
- Handle missing git repositories

## Next Steps

1. **Review this plan** and prioritize features
2. **Implement Phase 1** features one by one
3. **Test with different terminal widths**
4. **Gather feedback** and iterate
5. **Document configuration options**

## References

- @feniix/pi-statusline - Two-line status with model, thinking, context
- @nicobailon/pi-powerline-footer - Powerline style with token intelligence
- @carlosarraes/pi-statusbar - Context window usage with color coding
- @ajarellanod/pi-usage-bars - Provider usage statistics
- @zhangweiii/pi-status-line - Token semantics and cost tracking
