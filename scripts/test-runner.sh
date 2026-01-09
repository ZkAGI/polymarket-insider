#!/usr/bin/env bash
# Script to run tests with correct Node version

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use Node 20
nvm use 20.17.0 >/dev/null 2>&1

# Run the command passed as arguments
exec "$@"
