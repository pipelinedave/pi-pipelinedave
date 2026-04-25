---
name: web-search
description: Search the web using DuckDuckGo for current information, documentation, facts, and research. Free, no API key required.
---

# Web Search Skill

Search the web using DuckDuckGo - completely free, no API keys needed.

## Setup

**Nothing to configure!** Just use it.

The `duckduckgo-search` library is already installed and the `web-search` tool is available in your PATH.

## Usage

### Basic Search
```bash
# Search for information
~/.pi/agent/bin/web-search "react hooks best practices"

# Limit results
~/.pi/agent/bin/web-search "typescript generics" --limit 5

# Or add to PATH and use:
export PATH="$HOME/.pi/agent/bin:$PATH"
web-search "query"
```

### Extract Page Content
```bash
# Get full page content from top result
web-search "next.js tutorial" --extract

# Extract specific URL
web-search "https://example.com" --extract
```

### Search Types
```bash
# Web search (default)
web-search "query"

# News search
web-search "ai news" --type news

# Images search (returns URLs)
web-search "landscape photos" --type images

# Videos search
web-search "tutorial videos" --type videos
```

### Advanced Options
```bash
# Region-specific results
web-search "local news" --region us

# Safe search
web-search "query" --safesearch moderate

# Time range
web-search "latest updates" --timelimit y  # yearly
web-search "recent news" --timelimit m     # monthly
web-search "today's news" --timelimit d    # daily
```

## Use Cases

### Research & Facts
```bash
web-search "what is the latest stable version of Node.js"
```

### Documentation
```bash
web-search "React useEffect dependency array documentation"
```

### Current Events
```bash
web-search "Kubernetes 1.29 release notes"
```

### Code Solutions
```bash
web-search "how to handle async errors in Node.js Express"
```

### Comparison
```bash
web-search "Next.js vs Remix vs SvelteKit 2024"
```

## API Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--limit` | 10 | Number of results (1-30) |
| `--type` | web | Search type: web, news, images, videos |
| `--region` | auto | Region code (us, uk, de, etc.) |
| `--safesearch` | on | Safe search: on, moderate, off |
| `--timelimit` | null | Time filter: d, w, m, y |
| `--extract` | false | Extract content from URLs |

## Examples

### Find Latest Documentation
```bash
web-search "prisma 5.0 breaking changes" --limit 5
```

### Research Technology
```bash
web-search "WebAssembly use cases 2024" --extract-top
```

### Debug Error
```bash
web-search "docker build failed permission denied solution"
```

### Compare Technologies
```bash
web-search "PostgreSQL vs MongoDB performance comparison"
```

### Quick Facts
```bash
web-search "Node.js latest version" --limit 3
```

## Integration with Pi

When using with pi:

1. **Ask me to search**: "Search for React 19 new features"
2. **Use the tool directly**: `web-search "query"`
3. **Extract and summarize**: "Search and summarize top 3 results about X"

## Tips

- Be specific in queries for better results
- Use quotes for exact phrases: `"exact phrase"`
- Combine terms: "typescript + react + hooks tutorial"
- Add year for recent info: "python 3.12 features 2024"
- Use site: for specific sites: "site:stackoverflow.com react hooks"
- Use time filters for recent info: `--timelimit m` (month) or `--timelimit y` (year)

## Why DuckDuckGo?

- ✅ **100% free** - no API limits or quotas
- ✅ **No registration** - no API keys to manage
- ✅ **Privacy-first** - no tracking or profiling
- ✅ **Reliable** - powered by DuckDuckGo's search engine
- ✅ **No maintenance** - just works out of the box

## Troubleshooting

**No results?**
- Try simpler query
- Check internet connection
- Remove safe search filters if too restrictive

**Slow results?**
- Reduce limit parameter
- Try simpler query
- Check network connection

**Extract fails?**
- Some sites block scraping
- Try different source
- Use summary instead

---

**Auto-detected**: Web search capability for current information
**Required**: Nothing - just use it!
**Cost**: Free (unlimited queries)
