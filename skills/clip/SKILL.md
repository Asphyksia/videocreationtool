# clip — Video Clip Pipeline Skill

Download gambling compilations, split into individual plays, apply edits (B&W, templates), and upload to social media.

**CLI binary:** `clip` | **Version:** 0.1.0 | **Repo:** https://github.com/Asphyksia/videocreationtool

## Quick Start

```bash
# Full pipeline from a YouTube compilation
clip run -u "https://youtube.com/watch?v=XXXXX" -n 5 -f bw -p youtube,tiktok

# Step-by-step
clip vod download -u "https://youtube.com/watch?v=XXXXX"
clip vod split -i video.mp4 -m scenedetect --threshold 27 --min-length 3 --max-length 120
clip vod score -d clips/ -n 5
clip edit filter -i best/ -f bw -t minimal --resolution 1080x1920
clip upload -d output/ -p youtube,tiktok
```

## Quality Presets

`clip run` auto-detects your hardware and picks the best preset. You can override with `--preset`:

```bash
clip run -u "URL" -n 5 -f bw --preset low      # Force low-resource mode
clip run -u "URL" -n 5 --preset high            # Force max quality
clip run -u "URL" -n 5                          # Auto-detect (recommended)
```

| Preset | Download | Detection | Encoding | Output | RAM Use |
|--------|----------|-----------|----------|--------|---------|
| **high** | 1080p H.264 | scenedetect (no downscale) | libx264 medium | 1080x1920 | ~1.5GB |
| **balanced** | 720p H.264 | scenedetect (2x downscale) | libx264 fast | 1080x1920 | ~800MB |
| **low** | 480p H.264 | FFmpeg (4x downscale) | libx264 ultrafast | 720x1280 | ~300MB |

**Auto-detection logic:**
- GPU + NVENC + ≥8GB RAM → `high`
- ≥6GB RAM OR NVENC → `balanced`
- Otherwise → `low`

**When to force `--preset low`:**
- Machine has <8GB RAM and scenedetect gets OOM-killed
- NVIDIA driver <435 (NVENC not usable even if GPU present)
- i3/i5 CPU with ≤4 cores

Manual split also supports downscaling:
```bash
clip vod split -i video.mp4 -d 2    # Half resolution detection
clip vod split -i video.mp4 -d 4    # Quarter resolution detection
```

## Commands

### `clip auth` — Credential management
```bash
clip auth login            # Configure auth for a platform (YouTube/TikTok/Instagram)
clip auth status           # Show auth status for all platforms
```

### `clip config` — Configuration
```bash
clip config show           # Show current config (~/.clip-cli/config.json)
clip config set <key> <val> # Set template paths: templates.custom.logo, etc.
```

### `clip vod download` — Download a video
```bash
clip vod download -u "https://youtube.com/watch?v=XXXXX"
clip vod download -u "URL" -f "bestvideo[height<=1080]+bestaudio" -o ./downloads
```
Downloads via yt-dlp. Default format: `bestvideo[height<=1080]+bestaudio/best[height<=1080]`.

⚠️ **AV1 codec issue:** yt-dlp defaults to AV1 on many videos. PySceneDetect+OpenCV cannot decode AV1. Force H.264:
```bash
# Use this format for compatibility:
-f "bestvideo[height<=1080][vcodec^=avc1]+bestaudio[ext=m4a]/best[height<=1080]"
```

### `clip vod split` — Detect scenes and split
```bash
clip vod split -i video.mp4 -m scenedetect --threshold 27 --min-length 3 --max-length 120
clip vod split -i video.mp4 -m ffmpeg --threshold 0.3 --min-length 3   # FFmpeg fallback
clip vod split -i video.mp4 -m silence                                  # Silence-based
```
- **scenedetect** (default): PySceneDetect content-aware — best for gambling compilations. Requires H.264 input.
- **ffmpeg**: FFmpeg `select` filter — slower but works with any codec, including AV1. Use `--threshold 0.3` (normalized 0-1).
- **silence**: Detects silence gaps — useful for compilations with quiet transitions between plays.
- `--threshold` default: 27 (PySceneDetect), 0.3 (FFmpeg). Lower = more cuts.
- `--min-length` default: 3s. `--max-length` default: 120s.

### `clip vod score` — Score and rank clips
```bash
clip vod score -d clips/ -n 5 -m audio-peaks
```
Analyzes audio intensity peaks to rank clips by "emotional impact". Big wins → volume spikes → high score. Copies top N to `best/` directory.

### `clip edit filter` — Apply visual effects
```bash
clip edit filter -i best/ -f bw -t minimal --resolution 1080x1920
clip edit filter -i clip.mp4 -f bw-flash -t custom --logo ./logo.png --text "BIG WIN"
```
**Filters:** `bw`, `bw-flash`, `high-contrast`, `vhs`
**Templates:** `minimal` (clean), `custom` (logo + overlay from config)
**Resolution:** Default 1080x1920 (9:16 vertical)

### `clip upload` — Upload to social media
```bash
clip upload -d output/ -p youtube,tiktok,instagram --title "BIG WIN 🔥" --tags slots,bigwin
```
Requires `clip auth login` per platform. TikTok uses Playwright browser automation.

### `clip run` — Full pipeline (one command)
```bash
clip run -u "URL" -n 5 -f bw -t minimal -p youtube,tiktok
clip run -u "URL" -n 5 -f bw --no-upload --keep-intermediate  # Local-only test
clip run -u local_file.mp4 --skip-download                     # Use local file
clip run -u "URL" --preset low --no-upload                     # Low-resource mode
clip run -u "URL" --preset high -f bw-flash                    # Max quality + color flash
```

## Installation

### From source (pnpm monorepo)
```bash
git clone https://github.com/Asphyksia/videocreationtool
cd videocreationtool

# Create pnpm-workspace.yaml if missing (required by workspace:* protocol)
echo 'packages:
  - "packages/core"
  - "packages/cli"' > pnpm-workspace.yaml

# Install & build
pnpm install
pnpm add -D @types/node -w        # May be needed for TypeScript compilation
cd packages/core && pnpm build
cd ../cli && pnpm build && npm link  # Links `clip` globally
```

### Dependencies
| Tool | Purpose | Install |
|------|---------|---------|
| **Node.js ≥18** | Runtime | `apt install nodejs` or nvm |
| **pnpm** | Package manager | `npm install -g pnpm` |
| **Python ≥3.10** | Scene detection, scoring, upload | System/python.org |
| **FFmpeg** | Video processing | `apt install ffmpeg` |
| **yt-dlp** | Video download | `pip install yt-dlp` or [binary](https://github.com/yt-dlp/yt-dlp/releases) |
| **scenedetect** | Scene detection | `pip install "scenedetect[opencv]>=0.7"` |
| **librosa** | Audio analysis | `pip install librosa>=0.10.1` |
| **faster-whisper** | Transcription (optional) | `pip install faster-whisper>=1.0.0` |
| **playwright** | TikTok upload automation | `pip install playwright && python -m playwright install chromium` |
| **google-api-python-client** | YouTube upload | `pip install google-api-python-client google-auth-oauthlib` |

## Known Issues & Workarounds

### AV1 codec incompatibility
PySceneDetect with OpenCV backend cannot decode AV1 videos (YouTube increasingly serves AV1).
- **Fix 1:** Download H.264: `-f "bestvideo[vcodec^=avc1]+bestaudio"`
- **Fix 2:** Convert: `ffmpeg -i input.mp4 -c:v libx264 output.mp4`
- **Fix 3:** Use PyAV backend: `scenedetect -b pyav` (slower but handles AV1)

### PySceneDetect 0.7 breaking changes
The `--json` flag was removed in v0.7. The code parses stdout table output instead. Already fixed in repo.

### Memory limits on low-spec machines
PySceneDetect with OpenCV on 1080p60 video can use 150-250MB+ RAM per process. The sandbox kills processes that exceed memory limits.

**Solutions (in order of reliability):**
1. **Use `--preset low`** — forces FFmpeg detection (no OpenCV) + 4x downscale + ultrafast encoding
2. **Use `-d 2` or `-d 4`** downscaling with scenedetect: `clip vod split -i video.mp4 -d 4`
3. **Use FFmpeg detector directly:** `clip vod split -i video.mp4 -m ffmpeg --threshold 0.3`
4. Process in 1-2 minute chunks only

**If scenedetect gets SIGKILL'd**, the agent MUST fall back to `--preset low` or FFmpeg detection. Do NOT retry scenedetect on the same machine.

### `workspace:*` protocol
This project uses pnpm's workspace protocol. If using npm, convert `workspace:*` to `"*"` in `packages/cli/package.json` dependencies.

## Troubleshooting

```bash
# Check dependencies
clip config show
ffmpeg -version
yt-dlp --version
python3 -c "import scenedetect; print(scenedetect.__version__)"
python3 -c "import librosa; print(librosa.__version__)"
python3 -c "from playwright.sync_api import sync_playwright; print('OK')"

# Test scene detection directly
scenedetect -i video.mp4 detect-content -t 27 list-scenes -n

# Run pipeline step by step to isolate failures
clip vod download -u "URL"
clip vod split -i video.mp4 -m ffmpeg --threshold 0.3
clip vod score -d clips/ -n 5
clip edit filter -i best/ -f bw
```

## Config

Stored in `~/.clip-cli/config.json`:
```json
{
  "templates": {
    "custom": {
      "logo": "./my-logo.png",
      "font": "./my-font.ttf",
      "overlay": "./my-overlay.png"
    }
  },
  "defaults": {
    "filter": "bw",
    "template": "minimal",
    "resolution": "1080x1920",
    "platforms": ["youtube"]
  }
}
```

## Best Practices for Gambling Content

- **Threshold 27** works well — gambling compilations have frequent but distinct scene changes
- **Audio peak scoring** is effective — big wins cause volume spikes in reaction audio
- **B&W with flash** (`bw-flash` filter) is very effective visually — grayscale casino footage with color burst at win moment
- **min-length 3s, max-length 120s** filters out transitions while keeping substantial plays
- **Download H.264** (not AV1) to avoid compatibility issues with PySceneDetect
