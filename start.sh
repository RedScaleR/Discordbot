#!/usr/bin/env bash
# Run ./start.sh to start Mochi :3
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js isn't installed :<  Get it from https://nodejs.org (version 22 or newer), then try again."
  read -rp "Press Enter to close..."
  exit 1
fi

if ! node -e "const [a, b] = process.versions.node.split('.').map(Number); process.exit(a > 22 || (a === 22 && b >= 13) ? 0 : 1)"; then
  echo "Your Node.js is too old ($(node --version)). Mochi needs version 22.13 or newer from https://nodejs.org"
  read -rp "Press Enter to close..."
  exit 1
fi

if [ ! -f .env ]; then
  echo "First time setup! Paste your bot token and press Enter."
  echo "(Get it at https://discord.com/developers/applications -> your app -> Bot -> Reset Token)"
  read -rsp "Token: " token
  echo
  if [ -z "$token" ]; then
    echo "No token given, so I can't start. Run me again when you have it!"
    exit 1
  fi
  echo "DISCORD_TOKEN=$token" > .env
  echo "Saved to .env :3"
fi

# Installs anything missing, like new packages that came with an update.
if ! node tools/check-deps.js; then
  echo "Installing Mochi's stuff..."
  npm install --omit=dev || { echo "Install failed :<"; read -rp "Press Enter to close..."; exit 1; }
fi

npm start
read -rp "Mochi stopped. Press Enter to close..."
