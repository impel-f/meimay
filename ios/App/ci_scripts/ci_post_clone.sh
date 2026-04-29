#!/bin/sh
set -e

REPO_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$(cd "$(dirname "$0")/../../.." && pwd)}"
cd "$REPO_ROOT"

echo "Preparing Capacitor iOS project for Xcode Cloud"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Installing Node.js with Homebrew."
  brew install node
fi

echo "Node $(node -v)"
echo "npm $(npm -v)"

npm ci
npx cap sync ios

echo "Capacitor iOS project is ready"
