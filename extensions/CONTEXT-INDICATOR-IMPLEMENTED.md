# Context Window Indicator - Implementation Complete

## What Was Added

A context window usage indicator has been added to the pi footer in `status-bar.ts`.

## New Footer Format

```
💬 CHAT │ 📊 48,381  🔄 0  📂 0  🖥️ 0  🪟 45.2%/128k
```

The new `🪟` indicator shows:
- **Current usage percentage** (e.g., `45.2%`)
- **Context window size** (e.g., `128k`)
- **Color-coded warnings**:
  - Yellow when >70% used
  - Red when >90% used
- Shows `?` when usage is unknown (e.g., after compaction)

## Implementation Details

### Changes Made

1. **State tracking** - Added three new fields:
   - `contextTokens`: Current token count in context
   - `contextWindow`: Model's context window size
   - `contextPercent`: Percentage usage (or null if unknown)

2. **Data source** - Uses `ctx.getContextUsage()` which returns:
   - `tokens`: Current token count
   - `contextWindow`: Window size
   - `percent`: Percentage (0-100)

3. **Display format** - `🪟 XX.X%/128k` with ANSI color codes:
   - `\u001b[33m` (yellow) for 70-90%
   - `\u001b[31m` (red) for >90%

4. **Smart display** - Only shows when context window > 0

### File Modified

`/home/dhallmann/.pi/agent/extensions/status-bar.ts`

## Testing

The extension will be automatically reloaded on next pi restart or when you run `/reload`.

To see it in action:
1. Run `/reload` in pi, or
2. Restart pi

The indicator will appear in the footer alongside the existing stats.

## Future Enhancements

If you want to customize further:
- Change the emoji (currently `🪟` for window)
- Adjust warning thresholds (currently 70%/90%)
- Add remaining tokens display
- Add visual progress bar
- Show raw token count alongside percentage
