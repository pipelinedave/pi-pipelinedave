---
name: web-search
description: Search the web using Brave Search API for current information, documentation, facts, and research. Use when you need up-to-date information not in your training data.
---

# Web Search Skill

Search the web and extract content from webpages using Brave Search API.

## Setup

1. Get a free API key from [Brave Search API](https://brave.com/search/api/)

2. Set the environment variable:
```bash
export BRAVE_API_KEY="your-api-key-here"
```

3. Or create `~/.pi/agent/.env`:
```
BRAVE_API_KEY=your-api-key-here
```

## Usage

### Basic Search
```bash
# Search for information
brave-search "react hooks best practices"

# Limit results
brave-search "typescript generics" --limit 5
```

### Extract Page Content
```bash
# Get full page content
brave-search "https://example.com" --extract

# Search and extract top result
brave-search "next.js tutorial" --extract-top
```

### Search Types
```bash
# Web search (default)
brave-search "query"

# News search
brave-search "ai news" --type news

# Image search (returns URLs)
brave-search "landscape photos" --type images
```

## Use Cases

### Research & Facts
```bash
brave-search "what is the latest stable version of Node.js"
```

### Documentation
```bash
brave-search "React useEffect dependency array documentation"
```

### Current Events
```bash
brave-search "Kubernetes 1.29 release notes"
```

### Code Solutions
```bash
brave-search "how to handle async errors in Node.js Express"
```

### Comparison
```bash
brave-search "Next.js vs Remix vs SvelteKit 2024"
```

## API Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--limit` | 10 | Number of results (1-20) |
| `--type` | web | Search type: web, news, images |
| `--country` | US | Country code for localized results |
| `--safe` | true | Enable safe search |
| `--extract` | false | Extract content from URLs |

## Examples

### Find Latest Documentation
```bash
brave-search "prisma 5.0 breaking changes" --limit 5
```

### Research Technology
```bash
brave-search "WebAssembly use cases 2024" --extract-top
```

### Debug Error
```bash
brave-search "docker build failed permission denied solution"
```

### Compare Technologies
```bash
brave-search "PostgreSQL vs MongoDB performance comparison"
```

## Integration with Pi

When using with pi:

1. **Ask me to search**: "Search for React 19 new features"
2. **Use the tool directly**: `brave-search "query"`
3. **Extract and summarize**: "Search and summarize top 3 results about X"

## Tips

- Be specific in queries for better results
- Use quotes for exact phrases: `"exact phrase"`
- Combine terms: "typescript + react + hooks tutorial"
- Add year for recent info: "python 3.12 features 2024"
- Use site: for specific sites: "site:stackoverflow.com react hooks"

## Troubleshooting

**No results?**
- Check API key is set
- Try simpler query
- Check internet connection

**Rate limited?**
- Wait 60 seconds
- Reduce query frequency
- Upgrade API plan

**Extract fails?**
- Some sites block scraping
- Try different source
- Use summary instead

---

**Auto-detected**: Web search capability for current information
**Required**: BRAVE_API_KEY environment variable
**Cost**: Free tier: 2,000 queries/month
