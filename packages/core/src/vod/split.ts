/**
 * clip-cli-core: Scene detection and video splitting
 * 
 * Uses PySceneDetect for content-aware scene boundary detection,
 * then FFmpeg for precise splitting.
 */

import { execa } from "execa";
import { mkdir, readdir, stat, writeFile } from "fs/promises";
import { join, basename, extname } from "path";

export interface SplitOptions {
  input: string;
  outputDir?: string;
  method?: "scenedetect" | "ffmpeg" | "silence";
  threshold?: number;      // scene detection sensitivity (default: 27)
  minLength?: number;      // minimum clip length in seconds (default: 3)
  maxLength?: number;      // maximum clip length in seconds (default: 120)
  downscale?: number;      // downscale factor for scene detection (1=none, 2=half, 4=quarter)
}

export interface SceneBoundary {
  startTime: number;
  endTime: number;
  confidence?: number;
}

export interface SplitResult {
  clips: Array<{
    filePath: string;
    startTime: number;
    endTime: number;
    duration: number;
  }>;
  outputDir: string;
}

/**
 * Detect scene boundaries using PySceneDetect (Python)
 */
export async function detectScenes(opts: SplitOptions): Promise<SceneBoundary[]> {
  const threshold = opts.threshold ?? 27;
  const method = opts.method ?? "scenedetect";
  const downscale = opts.downscale ?? 1;

  if (method === "scenedetect") {
    return detectWithPySceneDetect(opts.input, threshold, downscale);
  } else if (method === "ffmpeg") {
    return detectWithFFmpeg(opts.input, threshold);
  } else {
    return detectWithSilence(opts.input);
  }
}

async function detectWithPySceneDetect(
  input: string,
  threshold: number,
  downscale: number = 1,
): Promise<SceneBoundary[]> {
  // PySceneDetect 0.7 removed --json; parse table output instead
  const args: string[] = [
    "-i", input,
    "detect-content",
    "-t", String(threshold),
    "list-scenes",
    "-n",       // print to stdout (no file)
  ];
  // Downscale before processing to save memory
  if (downscale > 1) {
    args.splice(2, 0, "-d", String(downscale));  // global flag after -i, before commands
  }
  const result = await execa("scenedetect", args, { reject: false });

  const output = result.stdout || result.stderr || "";
  const scenes: SceneBoundary[] = [];

  // Parse table rows: |  Scene #  | Start Frame |  Start Time  |  End Frame  |   End Time   |
  //                    |      1   |           1 | 00:00:00.000 |          51 | 00:00:02.040 |
  const tableRowRe = /^\s*\|\s+(\d+)\s+\|\s+\d+\s+\|\s+(\d+:\d+:\d+\.\d+)\s+\|\s+\d+\s+\|\s+(\d+:\d+:\d+\.\d+)\s+\|/;

  for (const line of output.split("\n")) {
    const match = line.match(tableRowRe);
    if (match) {
      scenes.push({
        startTime: parseTimestamp(match[2]!),  // Start Time
        endTime: parseTimestamp(match[3]!),    // End Time
      });
    }
  }

  return scenes;
}

async function detectWithFFmpeg(
  input: string,
  threshold: number,
): Promise<SceneBoundary[]> {
  const result = await execa("ffmpeg", [
    "-i", input,
    "-filter:v", `select='gt(scene,${threshold / 100})',showinfo`,
    "-f", "null",
    "-",
  ]);

  const scenes: SceneBoundary[] = [];
  let lastTime = 0;

  for (const line of result.stderr.split("\n")) {
    const match = line.match(/pts_time:(\d+\.?\d*)/);
    if (match) {
      const time = parseFloat(match[1]);
      if (scenes.length > 0) {
        scenes[scenes.length - 1]!.endTime = time;
      }
      scenes.push({ startTime: lastTime, endTime: time });
      lastTime = time;
    }
  }

  return scenes;
}

async function detectWithSilence(input: string): Promise<SceneBoundary[]> {
  // Detect silences as boundaries — useful for compilations with quiet gaps
  const result = await execa("ffmpeg", [
    "-i", input,
    "-af", "silencedetect=noise=-30dB:d=1",
    "-f", "null",
    "-",
  ]);

  const scenes: SceneBoundary[] = [];
  const silenceStarts: number[] = [];
  const silenceEnds: number[] = [];

  for (const line of result.stderr.split("\n")) {
    const startMatch = line.match(/silence_start:\s*(\d+\.?\d*)/);
    const endMatch = line.match(/silence_end:\s*(\d+\.?\d*)/);
    if (startMatch) silenceStarts.push(parseFloat(startMatch[1]));
    if (endMatch) silenceEnds.push(parseFloat(endMatch[1]));
  }

  // Build scenes from silence boundaries
  let prevEnd = 0;
  for (let i = 0; i < silenceStarts.length; i++) {
    scenes.push({
      startTime: prevEnd,
      endTime: silenceStarts[i]!,
    });
    prevEnd = silenceEnds[i] ?? silenceStarts[i]!;
  }
  // Final scene
  scenes.push({ startTime: prevEnd, endTime: -1 }); // -1 = until end

  return scenes;
}

/**
 * Split a video into clips based on detected scenes
 */
export async function splitVideo(opts: SplitOptions): Promise<SplitResult> {
  const scenes = await detectScenes(opts);
  const outputDir = opts.outputDir ?? join(".", "clips");
  const minLength = opts.minLength ?? 3;
  const maxLength = opts.maxLength ?? 120;

  await mkdir(outputDir, { recursive: true });

  // Filter scenes by length
  const validScenes = scenes.filter((s) => {
    const duration = s.endTime - s.startTime;
    return duration >= minLength && duration <= maxLength;
  });

  const clips: SplitResult["clips"] = [];
  const baseName = basename(opts.input, extname(opts.input));

  for (let i = 0; i < validScenes.length; i++) {
    const scene = validScenes[i]!;
    const index = String(i + 1).padStart(3, "0");
    const outputPath = join(outputDir, `${baseName}_clip_${index}.mp4`);

    const startTime = scene.startTime;
    const duration = scene.endTime > 0 ? scene.endTime - scene.startTime : undefined;

    const ffArgs = [
      "-i", opts.input,
      "-ss", String(startTime),
      ...(duration ? ["-t", String(duration)] : []),
      "-c:v", "libx264",
      "-c:a", "aac",
      "-y",
      outputPath,
    ];

    await execa("ffmpeg", ffArgs);

    clips.push({
      filePath: outputPath,
      startTime,
      endTime: scene.endTime,
      duration: scene.endTime - scene.startTime || 0,
    });
  }

  return { clips, outputDir };
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  return parts[0] ?? 0;
}

/**
 * Check dependencies
 */
export async function checkSplitDeps(): Promise<{
  ffmpeg: boolean;
  scenedetect: boolean;
}> {
  let ffmpeg = false;
  let scenedetect = false;
  try { await execa("ffmpeg", ["-version"]); ffmpeg = true; } catch { /* noop */ }
  try { await execa("scenedetect", ["version"]); scenedetect = true; } catch { /* noop */ }
  return { ffmpeg, scenedetect };
}