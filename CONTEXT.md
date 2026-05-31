# Videocreationtool — Contexto del Proyecto

## Resumen

CLI llamado `clip` que automatiza el pipeline de clips de gambling: descargar compilados de YouTube/Kick, detectar escenas, seleccionar los mejores momentos, aplicar edición (blanco y negro, plantillas), y subir a redes sociales. Repo: https://github.com/Asphyksia/videocreationtool

## Problemática Original

Un amigo de Maxi quiere automatizar la creación de contenido de gambling (slots). El workflow es:

1. **No** parte de VODs largos de 4 horas. Parte de **recopilatorios ya hechos** (videos de "best moments" de streamers de slots) que duran 5-15 minutos.
2. Necesita **split** del compilado en cada jugada individual (scene detection).
3. **Score** — quedarse con los mejores momentos (los más emocionantes, detectados por picos de audio).
4. **Edit** — aplicar filtro blanco y negro con una plantilla personalizada (logo, marco, texto).
5. **Upload** — subir los clips editados a YouTube Shorts, TikTok, Instagram Reels.

**NO es** generacion de video con IA. Es recortar, editar y re-subir contenido existente.

## Arquitectura

Monorepo npm con Commander.js, inspirado en el patrón de ModelStudioAI CLI (https://github.com/modelstudioai/cli):

```
clip-cli/
├── packages/
│   ├── core/                    # Librería compartida (TypeScript)
│   │   ├── src/
│   │   │   ├── vod/
│   │   │   │   ├── download.ts  # yt-dlp wrapper
│   │   │   │   ├── split.ts     # PySceneDetect + FFmpeg
│   │   │   │   └── score.ts     # Audio peak scoring
│   │   │   ├── edit/
│   │   │   │   └── filters.ts   # B&W, bw-flash, high-contrast, VHS, custom templates
│   │   │   ├── upload/
│   │   │   │   └── index.ts     # YouTube/TikTok/Instagram upload
│   │   │   └── index.ts
│   │   ├── scripts/             # Python scripts
│   │   │   ├── youtube_upload.py    # OAuth2 upload
│   │   │   ├── tiktok_upload.py     # Playwright browser automation
│   │   │   ├── instagram_upload.py  # Graph API
│   │   │   └── scenedetect_cli.py   # PySceneDetect wrapper
│   │   └── package.json
│   └── cli/                     # CLI commands (Commander.js)
│       └── src/
│           ├── main.ts           # Entry point
│           ├── commands/
│           │   ├── vod/          # download, split, score
│           │   ├── edit/         # filter
│           │   ├── auth/         # login, status
│           │   ├── config/       # set, show
│           │   ├── upload/        # upload
│           │   └── pipeline/      # run (todo en uno)
│           └── ...
├── skills/clip/SKILL.md        # Skill de OpenClaw
├── scripts/setup.sh             # Instalacion de dependencias
└── requirements.txt             # Python deps
```

## Comandos CLI

```bash
# Pipeline completo en un comando
clip pipeline run --url "https://youtube.com/watch?v=XXXXX" --top 5 --filter bw --platform youtube,tiktok

# Paso a paso
clip auth login --platform youtube
clip vod download --url "https://youtube.com/watch?v=XXXXX"
clip vod split --input video.mp4 --method scenedetect --threshold 27
clip vod score --dir clips/ --top 5
clip edit filter --input best/ --filter bw --template custom --logo ./logo.png
clip upload --dir output/ --platform youtube,tiktok,instagram

# Config
clip config set templates.custom.logo ./logo.png
clip config show
```

## Pipeline Detallado

### 1. Download (`clip vod download`)
- Usa `yt-dlp` para descargar videos de YouTube, Kick, Twitch
- Formato default: 1080p MP4
- Salida: archivo de video descargado

### 2. Split (`clip vod split`)
- **PySceneDetect** para deteccion de cambios de escena (content-aware)
- Metodo alternativo: FFmpeg scdet (threshold-based)
- Metodo alternativo: silencios (para compilados con gaps de audio)
- Filtra clips por duracion: 3-120 segundos por default
- Salida: directorio con clips individuales

### 3. Score (`clip vod score`)
- Analisis de picos de audio via FFmpeg `astats`
- Ranking por rango dinamico (peak dB - avg dB)
- En gambling: big wins = volumen alto = score alto
- Se queda con top N clips
- Salida: directorio `best/` con los mejores clips

### 4. Edit (`clip edit filter`)
- Filtros FFmpeg disponibles:
  - `bw` — Blanco y negro (hue=s=0)
  - `bw-flash` — B&W con flash de color en momentos de pico (deteccion de audio peaks)
  - `high-contrast` — Contraste aumentado
  - `vhs` — Efecto retro VHS
  - `custom` — Filtergraph personalizable
- Templates:
  - `minimal` — Solo el filtro, sin overlay
  - `custom` — Logo + marco + texto configurable
- Resolucion default: 1080x1920 (vertical 9:16)
- Salida: clips editados en `output/`

### 5. Upload (`clip upload`)
- **YouTube Shorts**: YouTube Data API v3 con OAuth2
- **TikTok**: Playwright browser automation (la API oficial es muy restrictiva)
- **Instagram Reels**: Graph API (requiere cuenta Business)
- Se necesita `clip auth login` previo para cada plataforma

## Dependencias

### Node.js (>=22.12)
- commander, execa, ora, yoctocolors, cli-table3

### Python (>=3.11)
- scenedetect[opencv] — Deteccion de escenas
- librosa — Analisis de audio (alternativa)
- faster-whisper — Transcripcion (alternativa)
- google-api-python-client, google-auth-oauthlib — YouTube upload
- playwright — TikTok upload
- requests — HTTP

### Sistema
- **ffmpeg** — Procesamiento de video
- **yt-dlp** — Descarga de videos
- **ffprobe** — Probes de video (viene con ffmpeg)

## Estado Actual

### ✅ Implementado
- Toda la estructura del monorepo
- Core completo: download, split, score, filters, upload
- CLI completo con Commander.js
- Auth para YouTube/TikTok/Instagram
- Pipeline runner (comando unico)
- Python scripts para upload y scenedetect
- Setup script
- OpenClaw skill

### 🟡 Necesita trabajo
- **Template system**: El overlay personalizado (logo, marco, texto) esta como stub en `filters.ts`. Necesita implementar FFmpeg drawtext + overlay properly con config del usuario.
- **Testing**: No hay tests. Probar con un compilado real de gambling para tunear el threshold de scenedetect.
- **Error handling**: Hay try/catch basico pero necesita mejor mensajes de error.
- **Logging/progress**: Ora spinners pero necesita mas detalle en pasos largos (download progress, split progress).
- **bw-flash filter**: La implementacion actual hace analisis de audio para encontrar peaks y habilitar color durante esos momentos. Funciona conceptualmente pero necesita testing con contenido real.
- **Upload scripts**: Los Python scripts son funcionalmente correctos pero necesitan testing con credenciales reales. TikTok usa Playwright headless=False (requiere browser visible para login manual la primera vez).
- **Build system**: El tsconfig y package.json estan configurados pero no se ha compilado todavia. Falta `npm run build` y verificar que los imports funcionen.

### ❌ No implementado
- **Comando `clip vod analyze`**: Diferente de `split` - seria para previsualizar sin cortar
- **Progreso de descarga**: yt-dlp muestra progress pero no se captura todavia
- **Retry logic**: En uploads y downloads
- **Rate limiting**: Para uploads a plataformas
- **Batch processing**: Procesar multiples URLs de una
- **Config wizard**: `clip auth login` interactivo (solo muestra instrucciones)
- **Dry-run**: `--dry-run` para simular sin ejecutar

## Notas de Diseño

- **No usar RelayGPU por ahora**. Originalmente se considero usar RelayGPU para generacion de video con IA (Wan 2.5/2.6, Kling, Sora), pero Maxi confirmo que no es necesario en la primera version. Se puede agregar despues.
- **No usar ModelStudioAI**. Se estudio como patron de arquitectura (monorepo, defineCommand, auth, async polling) pero no se adapto. El CLI es custom para este caso de uso.
- **Kick support**: yt-dlp soporta descarga de VODs de Kick. No hay API de chat como Twitch, pero para este use case (compilaciones ya hechas) no se necesita.
- **Prioridad**: La edicion principal es B&W con plantilla personalizada. Los efectos VHS y high-contrast son bonus.
- **Formato**: Todo se convierte a 1080x1920 (9:16 vertical) por default para Shorts/Reels/TikTok.

## Palabras Clave
- gambling, slots, compilaciones, highlights, clips, blanco y negro, B&W, edicion de video, scene detection, PySceneDetect, FFmpeg, yt-dlp, upload redes sociales, YouTube Shorts, TikTok, Instagram Reels