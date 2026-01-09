#!/usr/bin/env bash
# Initialize the development environment

set -e

# Determine the project root (parent of scripts directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Source nvm if available
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    \. "$NVM_DIR/nvm.sh"

    # Check if .nvmrc exists and use that version
    if [ -f ".nvmrc" ]; then
        echo "Using Node version from .nvmrc..."
        nvm use
    fi
fi

# Display Node version being used
echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Run the development server
echo "Starting development server..."
npm run dev
