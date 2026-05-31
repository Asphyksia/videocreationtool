/**
 * clip-cli-core: Video editing filters and templates
 * 
 * Applies FFmpeg filtergraphs for:
 * - B&W / grayscale
 * - B&W with color flash at peaks
 * - High contrast
 * - VHS retro effect
 * - Custom template overlays (logo, frame, text)
 */

import { execa } from "execa";
import { readdir, mkdir } from "fs/promises";
import { join, extname, basename } from "path";

// ─── Hardware encoding detection ────────────────────────────────────

let nvencAvailable: boolean | null = null;

async function detectNVENC(): Promise<boolean> {
  if (nvencAvailable !== null) return nvencAvailable;
  try {
    // Check encoders list
    const result = await execa("ffmpeg", ["-encoders"], { reject: false });
    const hasEncoder = (result.stdout + result.stderr).includes("h264_nvenc");
    if (!hasEncoder) { nvencAvailable = false; return false; }

    // Check NVIDIA driver version supports NVENC
    // Driver 390.x is too old; need >= 418 for NVENC API 9.1, >= 435 for 10.0
    const smi = await execa("nvidia-smi", [
      "--query-gpu=driver_version",
      "--format=csv,noheader",
    ], { reject: false });
    const driverVer = parseFloat(smi.stdout.trim()) || 0;
    
    // NVENC requires driver >= 435 for decent API support
    nvencAvailable = driverVer >= 435;
    if (!nvencAvailable) {
      console.log(`  ⚠ NVENC encoder found but NVIDIA driver ${driverVer} is too old (need >= 435). Falling back to CPU encoding.`);
    }
  } catch {
    nvencAvailable = false;
  }
  return nvencAvailable;
}

function getEncoderConfig(useHW: boolean): { codec: string; preset: string; crf: string } {
  if (useHW) {
    return { codec: "h264_nvenc", preset: "p4", crf: "23" };
  }
  return { codec: "libx264", preset: "fast", crf: "23" };
}

export type FilterType = "bw" | "bw-flash" | "high-contrast" | "vhs" | "custom";
export type TemplateType = "minimal" | "custom";

export interface EditOptions {
  inputDir: string;
  outputDir?: string;
  filter: FilterType;
  template?: TemplateType;
  logoPath?: string;
  overlayPath?: string;
  fontPath?: string;
  text?: string;
  resolution?: string;  // e.g. "1080x1920" for vertical
}

export interface EditResult {
  outputPath: string;
  filterApplied: FilterType;
  templateApplied?: TemplateType;
}

// ─── Filter definitions ───────────────────────────────────────────────

const FILTERS: Record<FilterType, (opts?: EditOptions) => string> = {
  bw: () => "hue=s=0",
  
  "bw-flash": (opts) => {
    // B&W baseline with color flash at loud moments
    // We apply grayscale globally, then re-enable saturation when volume peaks
    // Requires two passes: detect peaks, then apply conditional filter
    // Simplified version: full B&W. Peak detection pass is done separately.
    return "hue=s=0";
  },
  
  "high-contrast": () => "eq=contrast=1.5:brightness=0.05",
  
  vhs: () => {
    // VHS retro effect: slight noise, reduced saturation, softer
    return "noise=c=5:s=t,eq=contrast=1.2:brightness=-0.02:saturation=0.7,smartblur=lr=1:lt=0.5:cr=0:ct=0";
  },
  
  custom: () => "hue=s=0", // Default to B&W, template overlay adds the rest
};

// ─── Template definitions ─────────────────────────────────────────────

function applyTemplateFilter(opts: EditOptions): string[] {
  const filters: string[] = [];
  
  if (opts.resolution) {
    const [w, h] = opts.resolution.split("x").map(Number);
    filters.push(`scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`);
  } else {
    // Default vertical 9:16
    filters.push("scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2");
  }
  
  return filters;
}

// ─── Apply filter to a single video ───────────────────────────────────

export async function applyFilter(
  inputPath: string,
  opts: EditOptions,
): Promise<EditResult> {
  const videoFilter = FILTERS[opts.filter](opts);
  const templateFilters = opts.template ? applyTemplateFilter(opts) : [];
  
  const allFilters = [videoFilter, ...templateFilters].join(",");
  
  const outputDir = opts.outputDir ?? join(opts.inputDir, "edited");
  await mkdir(outputDir, { recursive: true });
  
  const outputFile = join(outputDir, basename(inputPath, extname(inputPath)) + "_edited.mp4");
  
  const useNVENC = await detectNVENC();
  const enc = getEncoderConfig(useNVENC);
  
  const args = [
    "-i", inputPath,
    ...(opts.logoPath ? ["-i", opts.logoPath] : []),
    ...(opts.overlayPath ? ["-i", opts.overlayPath] : []),
    "-vf", allFilters,
    "-c:v", enc.codec,
    "-preset", enc.preset,
    "-crf", enc.crf,
    "-c:a", "aac",
    "-b:a", "128k",
    "-y",
    outputFile,
  ];
  
  // NVENC specific: use -cq instead of -crf, add -rc vbr
  if (useNVENC) {
    // Replace -crf with -cq for NVENC
    const crfIdx = args.indexOf("-crf");
    if (crfIdx !== -1) {
      args[crfIdx] = "-cq";
    }
    // Add VBR rate control
    args.push("-rc", "vbr");
  }
  
  try {
    await execa("ffmpeg", args);
  } catch (encodingErr: any) {
    // If NVENC fails (e.g. driver too old), fallback to CPU encoding
    if (useNVENC && encodingErr.message?.includes("nvenc")) {
      console.log("  ⚠ NVENC failed, retrying with CPU encoding...");
      const crfIdx2 = args.indexOf("-cq");
      if (crfIdx2 !== -1) args[crfIdx2] = "-crf";
      // Remove -rc vbr if present
      const rcIdx = args.indexOf("-rc");
      if (rcIdx !== -1) args.splice(rcIdx, 2);
      // Replace encoder
      const encIdx = args.indexOf("h264_nvenc");
      if (encIdx !== -1) args[encIdx] = "libx264";
      const presetIdx = args.indexOf("-preset");
      if (presetIdx !== -1 && args[presetIdx + 1]) args[presetIdx + 1] = "ultrafast";
      await execa("ffmpeg", args);
    } else {
      throw encodingErr;
    }
  }
  
  return {
    outputPath: outputFile,
    filterApplied: opts.filter,
    templateApplied: opts.template,
  };
}

// ─── Process all videos in a directory ────────────────────────────────

export async function editDirectory(opts: EditOptions): Promise<EditResult[]> {
  const files = (await readdir(opts.inputDir)).filter((f) =>
    [".mp4", ".mkv", ".avi", ".mov"].includes(extname(f).toLowerCase())
  );
  
  const results: EditResult[] = [];
  
  for (const file of files) {
    const result = await applyFilter(join(opts.inputDir, file), opts);
    results.push(result);
  }
  
  return results;
}

// ─── BW-flash with peak detection (two-pass) ──────────────────────────

export interface BWFlashOptions {
  inputPath: string;
  outputPath: string;
  flashDuration?: number;  // seconds of color at peak (default: 1.5)
  thresholdDb?: number;     // dB above average to trigger flash (default: 6)
}

/**
 * Apply B&W with color flashes at peak moments.
 * This is a two-pass process:
 * 1. Analyze audio to find peak timestamps
 * 2. Apply conditional hue filter
 */
export async function applyBWFlash(
  opts: BWFlashOptions,
): Promise<string> {
  const analysis = await analyzeVideoForFlash(opts.inputPath);
  const flashDuration = opts.flashDuration ?? 1.5;
  const threshold = opts.thresholdDb ?? 6;
  
  // Build enable expression for hue filter
  // Default to B&W (s=0), enable color (s=1) during flash windows
  const enableParts = analysis.peaks
    .filter((p) => p.dbAboveAvg >= threshold)
    .map((p) => `between(t,${Math.max(0, p.time - 0.2)},${p.time + flashDuration})`);
  
  const enableExpr = enableParts.length > 0
    ? `hue=s=0:enable='${enableParts.join("+")}'`
    : "hue=s=0";
  
  const useNVENC = await detectNVENC();
  const enc = getEncoderConfig(useNVENC);
  
  await execa("ffmpeg", [
    "-i", opts.inputPath,
    "-vf", enableExpr,
    "-c:v", enc.codec,
    "-preset", enc.preset,
    "-crf", enc.crf,
    "-c:a", "aac",
    "-b:a", "128k",
    "-y",
    opts.outputPath,
  ]);
  
  return opts.outputPath;
}

interface PeakMoment {
  time: number;
  dbAboveAvg: number;
}

async function analyzeVideoForFlash(
  filePath: string,
): Promise<{ avgDb: number; peaks: PeakMoment[] }> {
  const result = await execa("ffmpeg", [
    "-i", filePath,
    "-af", "astats=metadata=1:reset=0.1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-",
    "-f", "null",
    "-",
  ]);

  const rmsValues: { time: number; db: number }[] = [];
  let timeOffset = 0;

  for (const line of result.stderr.split("\n")) {
    const match = line.match(/lavfi\.astats\.Overall\.RMS_level=(-?\d+\.?\d*)/);
    if (match) {
      rmsValues.push({ time: timeOffset, db: parseFloat(match[1]!) });
      timeOffset += 0.1;
    }
  }

  if (rmsValues.length === 0) {
    return { avgDb: -60, peaks: [] };
  }

  const avgDb = rmsValues.reduce((a, b) => a + b.db, 0) / rmsValues.length;
  
  // Find peaks: points significantly above average
  const peaks: PeakMoment[] = [];
  for (const point of rmsValues) {
    const dbAboveAvg = point.db - avgDb;
    if (dbAboveAvg >= 6) { // 6dB above average = significant peak
      peaks.push({ time: point.time, dbAboveAvg });
    }
  }

  // Merge adjacent peaks (within 0.5s)
  const merged: PeakMoment[] = [];
  for (const peak of peaks) {
    if (merged.length === 0 || peak.time - merged[merged.length - 1]!.time > 0.5) {
      merged.push(peak);
    }
  }

  return { avgDb, peaks: merged };
}