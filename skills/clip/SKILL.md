# clip — Video Clip Pipeline Skill

Download gambling compilations, split into individual plays, apply edits (B&W, templates), and upload to social media.

## Commands

### Download a compilation
```
clip download "https://youtube.com/watch?v=XXXXX"
clip download "https://kick.com/video/XXXXX"
```
Downloads the video using yt-dlp. Returns the local file path.

### Split into individual clips
```
clip split compilation.mp4
clip split compilation.mp4 --threshold 30 --min-length 3
```
Detects scene changes and splits the video into individual clips. Uses PySceneDetect (content-aware) by default. Returns list of clip file paths.

### Score and select best clips
```
clip score clips/
clip score clips/ --top 5
clip score clips/ --method audio-peaks
```
Analyzes audio intensity to rank clips by emotional impact. Copies top N clips to a `best/` directory.

### Apply visual filters
```
clip edit best/ --filter bw
clip edit best/ --filter bw-flash
clip edit best/ --filter high-contrast
clip edit best/ --filter bw --template custom
```
Applies FFmpeg filters to all clips in a directory.

**Filters:** `bw` (grayscale), `bw-flash` (B&W with color flash at peaks), `high-contrast`, `vhs` (retro effect)

**Templates:** `minimal` (clean), `custom` (logo + frame from config)

### Upload to social media
```
clip upload output/ --platform youtube,tiktok,instagram
clip upload output/ --platform youtube --title "BIG WIN 🔥" --tags slots,bigwin
```
Uploads processed clips to the specified platforms. Requires prior `clip auth login` for each platform.

### Run full pipeline
```
clip pipeline --url "https://youtube.com/watch?v=XXXXX" --top 5 --filter bw --platform youtube,tiktok
```
Runs the entire pipeline: download → split → score → edit → upload.

## Prerequisites

- `clip` CLI installed (`npm install -g clip-cli` or from source)
- FFmpeg in PATH
- yt-dlp in PATH
- Python 3.11+ with: `scenedetect[opencv]`, `librosa`
- API credentials configured via `clip auth login`

## Install

```bash
npm install -g clip-cli
clip auth login
```

## Config

Stored in `~/.clip-cli/config.json`. Set custom templates:
```bash
clip config set templates.custom.logo ./my-logo.png
clip config set templates.custom.font ./my-font.ttf
clip config set templates.custom.overlay ./my-overlay.png
```

## Notes

- Scene detection threshold default is 27 (adjustable for gambling content which has frequent cuts)
- Audio peak scoring works well for gambling — big wins cause volume spikes
- B&W filter with flash of color at peak moments is very effective for slots content
- Upload to TikTok uses browser automation (Playwright) due to API limitations