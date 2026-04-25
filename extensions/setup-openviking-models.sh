#!/bin/bash
# OpenViking Model Setup Script
# This script configures embedding models for semantic search

set -e

echo "🚀 OpenViking Semantic Search Setup"
echo "===================================="
echo ""
echo "To enable semantic search and auto-summaries, you need API credentials."
echo ""
echo "Options:"
echo "  1. OpenAI (Recommended - easiest setup)"
echo "  2. Volcengine (Default for OpenViking)"
echo "  3. Skip for now (search won't work)"
echo ""
read -p "Choose option [1-3]: " choice

case $choice in
  1)
    echo ""
    echo "📝 OpenAI Setup"
    echo "--------------"
    echo "Get your API key from: https://platform.openai.com/api-keys"
    echo ""
    read -sp "Enter your OpenAI API key: " API_KEY
    echo ""
    
    # Create config directory if needed
    mkdir -p /home/dhallmann/.openviking
    
    # Create configuration
    cat > /home/dhallmann/.openviking/ov.conf << EOF
[vlm]
provider = openai
model = gpt-4o
api_key = $API_KEY
api_base = https://api.openai.com/v1

[embedding]
provider = openai
model = text-embedding-3-small
api_key = $API_KEY
api_base = https://api.openai.com/v1

[rerank]
provider = openai
model = gpt-4o
api_key = $API_KEY
api_base = https://api.openai.com/v1

[storage]
path = /home/dhallmann/openviking-workspace
EOF
    
    echo "✅ Configuration created!"
    ;;
    
  2)
    echo ""
    echo "📝 Volcengine Setup"
    echo "------------------"
    echo "Get your API key from: https://console.volcengine.com/ark/region:ark+cn-beijing/model"
    echo ""
    read -sp "Enter your Volcengine API key: " API_KEY
    echo ""
    
    mkdir -p /home/dhallmann/.openviking
    
    cat > /home/dhallmann/.openviking/ov.conf << EOF
[vlm]
provider = volcengine
model = doubao-seed-2-0-pro-260215
api_key = $API_KEY
api_base = https://ark.cn-beijing.volces.com/api/v3

[embedding]
provider = volcengine
model = embedding-v3
api_key = $API_KEY
api_base = https://ark.cn-beijing.volces.com/api/v3

[rerank]
provider = volcengine
model = rerank-v3.5
api_key = $API_KEY
api_base = https://ark.cn-beijing.volces.com/api/v3

[storage]
path = /home/dhallmann/openviking-workspace
EOF
    
    echo "✅ Configuration created!"
    ;;
    
  3)
    echo ""
    echo "⏭️  Skipping model setup"
    echo "Semantic search will not work until models are configured."
    echo "Run this script again when you have API credentials."
    exit 0
    ;;
    
  *)
    echo "Invalid option. Exiting."
    exit 1
    ;;
esac

echo ""
echo "🔄 Restarting OpenViking server with new configuration..."

# Stop existing server
pkill -f "openviking-server" || true
sleep 2

# Start with new config
cd /home/dhallmann/openviking-workspace
nohup /home/dhallmann/openviking-workspace/ovenv/bin/openviking-server start > /tmp/openviking.log 2>&1 &

echo "⏳ Server starting..."
sleep 5

# Verify it's running
if curl -s http://localhost:1933/health > /dev/null 2>&1; then
  echo "✅ Server is running!"
  echo ""
  echo "🧪 Testing semantic search..."
  curl -s http://localhost:1933/api/v1/search/find \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"query":"test","limit":1}' | python3 -m json.tool 2>/dev/null || echo "Search endpoint responded"
  echo ""
  echo "🎉 Setup complete!"
  echo ""
  echo "You can now use semantic search in pi.dev:"
  echo "  /viking-search your query here"
  echo "  viking_search tool (via LLM)"
else
  echo "⚠️  Server may not have started correctly"
  echo "Check logs: cat /tmp/openviking.log"
fi
