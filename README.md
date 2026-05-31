# clip-cli

CLI for downloading, splitting, editing, and uploading gambling compilation clips.

## Pipeline

```
Download → Split → Score → Edit → Upload
```

1. **Download** — Grab compilations from YouTube/Kick via `yt-dlp`
2. **Split** — Detect scene changes between plays via `PySceneDetect` + FFmpeg
3. **Score** — Rank clips by audio emotion peaks (librosa)
4. **Edit** — Apply B&W filter, custom template (logo, frame, text) via FFmpeg
5. **Upload** — Push to YouTube Shorts, TikTok, Instagram Reels

## Install

```bash
# Prerequisites
pip install scenedetect[opencv] librosa faster-whisper
npm install -g yt-dlp  # or: pip install yt-dlp

# From source
git clone <repo-url> clip-cli
cd clip-cli
npm install
npm run build -w packages/core
npm run build -w packages/cli
npm link packages/cli
```

## Quick Start

```bash
# Authenticate
clip auth login

# Download a compilation
clip vod download --url "https://youtube.com/watch?v=XXXXX"

# Split into individual plays
clip vod split --input compilation.mp4 --method scenedetect

# Score and select top clips
clip vod score --dir clips/ --top 5

# Edit: B&W + custom template
clip edit filter --input best/ --filter bw --template custom

# Upload
clip upload --dir output/ --platform youtube,tiktok,instagram

# Or do everything in one command
clip pipeline run --url "https://youtube.com/watch?v=XXXXX" --top 5 --filter bw --template custom --platform youtube,tiktok
```

## Commands

### `clip vod download`
Download a video from YouTube/Kick/Twitch.

```bash
clip vod download --url "https://youtube.com/watch?v=XXXXX" [--format 1080p] [--output ./downloads/]
```

### `clip vod split`
Split a video into individual clips using scene detection.

```bash
clip vod split --input compilation.mp4 --method scenedetect [--threshold 27] [--min-length 3] [--output ./clips/]
```

### `clip vod score`
Score and rank clips by emotional intensity.

```bash
clip vod score --dir clips/ --top 5 [--method audio-peaks] [--output ./best/]
```

### `clip edit filter`
Apply visual filters and templates to clips.

```bash
clip edit filter --input best/ --filter bw --template custom [--output ./output/]
clip edit filter --input best/ --filter bw --template minimal
```

**Available filters:**
- `bw` — Black and white (grayscale)
- `bw-flash` — B&W with color flash at peak moments
- `high-contrast` — Increased contrast for dramatic effect
- `vhs` — VHS retro effect
- `custom` — Use custom FFmpeg filtergraph from config

**Templates:**
- `minimal` — Clean, no overlay
- `custom` — Uses your custom template (logo, frame, text) from config

### `clip upload`
Upload processed clips to social media platforms.

```bash
clip upload --dir output/ --platform youtube,tiktok,instagram [--title "BIG WIN 🔥"] [--tags slots,casino,bigwin]
```

### `clip pipeline run`
Run the full pipeline in one command.

```bash
clip pipeline run --url "https://youtube.com/watch?v=XXXXX" --top 5 --filter bw --template custom --platform youtube,tiktok
```

## Configuration

```bash
clip auth login           # Set up API keys and credentials
clip config show          # Show current config
clip config set templates.custom.logo ./logo.png
clip config set templates.custom.font ./font.ttf
```

Config stored in `~/.clip-cli/config.json`.

## Requirements

- **Node.js** >= 22.12
- **Python** >= 3.11 (for scene detection & audio analysis)
- **FFmpeg** in PATH
- **yt-dlp** in PATH

## License

Apache-2.0