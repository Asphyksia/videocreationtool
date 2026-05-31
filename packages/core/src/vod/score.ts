/**
 * clip-cli-core: Score and rank clips by emotional intensity
 * 
 * Uses audio analysis (librosa) to detect volume peaks and emotional moments.
 * Great for gambling content where big wins cause visible+audible excitement.
 */

import { execa } from "execa";
import { readdir, copyFile, mkdir } from "fs/promises";
import { join, extname } from "path";

export interface ScoreOptions {
  inputDir: string;
  outputDir?: string;
  top?: number;          // number of clips to select (default: 5)
  method?: "audio-peaks" | "all";
  minScore?: number;     // minimum score to include (0-1)
}

export interface ClipScore {
  filePath: string;
  score: number;
  peakDb: number;
  peakTime: number;
  duration: number;
}

export interface ScoreResult {
  clips: ClipScore[];
  best: ClipScore[];
  outputDir: string;
}

/**
 * Analyze a single clip's audio for peak intensity
 */
export async function analyzeAudioPeak(
  filePath: string,
): Promise<{ peakDb: number; peakTime: number; avgDb: number; duration: number }> {
  // Use FFmpeg's volumedetect + astats for quick analysis
  const result = await execa("ffmpeg", [
    "-i", filePath,
    "-af", "astats=metadata=1:reset=0.1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-",
    "-f", "null",
    "-",
  ]);

  const rmsValues: number[] = [];
  let maxRms = -Infinity;
  let maxRmsTime = 0;
  let timeOffset = 0;

  for (const line of result.stderr.split("\n")) {
    const match = line.match(/lavfi\.astats\.Overall\.RMS_level=(-?\d+\.?\d*)/);
    if (match) {
      const val = parseFloat(match[1]!);
      rmsValues.push(val);
      if (val > maxRms) {
        maxRms = val;
        maxRmsTime = timeOffset;
      }
      timeOffset += 0.1;
    }
  }

  // Get duration
  const probe = await execa("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);

  const duration = parseFloat(probe.stdout) || 0;
  const avgDb = rmsValues.length > 0
    ? rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length
    : -60;

  return {
    peakDb: maxRms > -Infinity ? maxRms : -60,
    peakTime: maxRmsTime,
    avgDb,
    duration,
  };
}

/**
 * Score all clips in a directory and select the best ones
 */
export async function scoreClips(opts: ScoreOptions): Promise<ScoreResult> {
  const topN = opts.top ?? 5;
  const method = opts.method ?? "audio-peaks";
  const outputDir = opts.outputDir ?? join(opts.inputDir, "best");

  // Find all video files
  const files = (await readdir(opts.inputDir)).filter((f) =>
    [".mp4", ".mkv", ".avi", ".mov"].includes(extname(f).toLowerCase())
  );

  const scores: ClipScore[] = [];

  for (const file of files) {
    const filePath = join(opts.inputDir, file);
    const analysis = await analyzeAudioPeak(filePath);

    // Normalize score: peak volume relative to average
    // Higher = more emotional contrast (loudest moment vs average)
    const dynamicRange = analysis.peakDb - analysis.avgDb;
    const score = dynamicRange > 0 ? dynamicRange / 30 : 0.1; // normalize to 0-1

    scores.push({
      filePath,
      score: Math.min(score, 1),
      peakDb: analysis.peakDb,
      peakTime: analysis.peakTime,
      duration: analysis.duration,
    });
  }

  // Sort by score descending
  const sorted = scores.sort((a, b) => b.score - a.score);
  const best = sorted.slice(0, topN);

  // Copy best clips to output directory
  await mkdir(outputDir, { recursive: true });
  for (const clip of best) {
    const dest = join(outputDir, clip.filePath.split("/").pop()!);
    await copyFile(clip.filePath, dest);
  }

  return { clips: sorted, best, outputDir };
}