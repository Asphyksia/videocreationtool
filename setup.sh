#!/usr/bin/env bash
# clip-cli setup script
# Installs all required dependencies

set -e

echo "🎬 clip-cli Setup"
echo "=================="
echo

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "❌ Node.js is required (>=22.12). Install from https://nodejs.org/"
  exit 1
fi
echo "✓ Node.js $(node --version)"

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "❌ Python 3.11+ is required."
  exit 1
fi
echo "✓ Python $(python3 --version)"

# Check ffmpeg
if ! command -v ffmpeg &>/dev/null; then
  echo "❌ ffmpeg is required. Install: apt install ffmpeg / brew install ffmpeg"
  exit 1
fi
echo "✓ ffmpeg $(ffmpeg -version | head -1)"

# Check yt-dlp
if ! command -v yt-dlp &>/dev/null; then
  echo "⚠ yt-dlp not found. Installing..."
  pip install yt-dlp
fi
echo "✓ yt-dlp $(yt-dlp --version)"

# Install Python dependencies
echo
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Install Playwright browsers
echo "Installing Playwright browsers..."
python3 -m playwright install chromium

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

# Build packages
echo "Building packages..."
npm run build -w packages/core
npm run build -w packages/cli

# Link CLI
echo "Linking CLI globally..."
npm link packages/cli

echo
echo "✓ Setup complete!"
echo
echo "Next steps:"
echo "  1. clip auth login --platform youtube"
echo "  2. clip auth login --platform tiktok"
echo "  3. clip auth login --platform instagram"
echo
echo "Quick start:"
echo "  clip pipeline run --url 'https://youtube.com/watch?v=XXXXX' --top 5 --filter bw"