# Web Search - DuckDuckGo Setup

## ✅ Done! No API Key Needed

The web search tool is now set up to use **DuckDuckGo** instead of Brave Search.

## Benefits

- ✅ **100% Free** - No API limits or quotas
- ✅ **No API Key** - Just works out of the box
- ✅ **Privacy-Focused** - No tracking
- ✅ **Already Installed** - Uses existing `duckduckgo-search` library

## Usage

```bash
# Basic search
~/.pi/agent/bin/web-search "your query here"

# With options
~/.pi/agent/bin/web-search "query" --limit 5 --type news

# Add to PATH for easier use
export PATH="$HOME/.pi/agent/bin:$PATH"
web-search "query"
```

## Options

| Flag | Description | Example |
|------|-------------|---------|
| `--limit N` | Number of results | `--limit 5` |
| `--type TYPE` | Search type | `--type news` |
| `--extract` | Extract URL content | `--extract` |
| `--json` | Output as JSON | `--json` |

## Search Types

- `web` - General web search (default)
- `news` - News articles
- `images` - Image search
- `videos` - Video search

## Examples

```bash
# Web search
web-search "React 19 new features"

# News search
web-search "AI developments" --type news

# Get JSON output
web-search "Node.js version" --json

# Extract from URL
web-search "https://example.com" --extract
```

## Technical Details

- **Tool Location**: `~/.pi/agent/bin/web-search`
- **Backend**: DuckDuckGo via `ddgs` Python library
- **No Dependencies**: Already installed on your system

---

**No more API keys! No more limits! Just search.**
