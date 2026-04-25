#!/bin/bash
# OpenViking Integration Setup Script for pi.dev

set -e

echo "🚀 Setting up OpenViking integration for pi.dev..."

# Check if OpenViking is installed
echo "📦 Checking OpenViking installation..."
if ! command -v openviking-server &> /dev/null; then
    echo "❌ OpenViking not found. Installing..."
    pip install openviking --upgrade --force-reinstall
    echo "✅ OpenViking installed"
else
    echo "✅ OpenViking already installed"
fi

# Check if extension exists
EXTENSION_PATH="$HOME/.pi/agent/extensions/openviking-integration.ts"
if [ ! -f "$EXTENSION_PATH" ]; then
    echo "❌ Extension not found at $EXTENSION_PATH"
    echo "Please ensure the extension file exists"
    exit 1
fi

echo "✅ Extension file exists"

# Check if OpenViking workspace exists
WORKSPACE_PATH="/home/dhallmann/openviking-workspace"
if [ ! -d "$WORKSPACE_PATH" ]; then
    echo "⚠️  OpenViking workspace not found at $WORKSPACE_PATH"
    echo "Creating workspace..."
    mkdir -p "$WORKSPACE_PATH"
    echo "✅ Workspace created"
else
    echo "✅ Workspace exists at $WORKSPACE_PATH"
fi

# Check if OpenViking server is running
echo "🔍 Checking OpenViking server..."
if curl -s http://localhost:1933/api/v1/health > /dev/null 2>&1; then
    echo "✅ OpenViking server is running"
else
    echo "⚠️  OpenViking server is not running"
    echo ""
    echo "To start the server, run:"
    echo "  openviking-server start --path $WORKSPACE_PATH"
    echo ""
    echo "Or in background:"
    echo "  nohup openviking-server start --path $WORKSPACE_PATH > /tmp/openviking.log 2>&1 &"
fi

# Summary
echo ""
echo "📋 Setup Summary:"
echo "  Extension: $EXTENSION_PATH"
echo "  Workspace: $WORKSPACE_PATH"
echo "  Server: http://localhost:1933"
echo ""
echo "🎯 Next Steps:"
echo "  1. Start OpenViking server (if not running):"
echo "     openviking-server start --path $WORKSPACE_PATH"
echo ""
echo "  2. Reload pi.dev extensions:"
echo "     /reload"
echo ""
echo "  3. Test the integration:"
echo "     /viking-status"
echo ""
echo "  4. Try searching:"
echo "     /viking-search your query here"
echo ""
echo "✅ OpenViking integration setup complete!"
