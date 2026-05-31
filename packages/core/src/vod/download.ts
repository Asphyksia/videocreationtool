/**
 * clip-cli-core: Download videos from YouTube/Kick/Twitch via yt-dlp
 */

import { execa } from "execa";

export interface DownloadOptions {
  url: string;
  format?: string;     // e.g. "bestvideo[height<=1080]+bestaudio"
  output?: string;      // output path or template
  mergeOutputFormat?: string; // e.g. "mp4"
}

export interface DownloadResult {
  filePath: string;
  title: string;
  duration: number;
  thumbnail?: string;
}

/**
 * Download a video from a URL using yt-dlp
 */
export async function downloadVideo(opts: DownloadOptions): Promise<DownloadResult> {
  const format = opts.format ?? "bestvideo[height<=1080]+bestaudio/best[height<=1080]";
  const merge = opts.mergeOutputFormat ?? "mp4";
  const output = opts.output ?? "%(title)s.%(ext)s";

  const args = [
    "--no-warnings",
    "--no-playlist",
    "-f", format,
    "--merge-output-format", merge,
    "-o", output,
    "--print", "after_move:filepath",
    "--print", "duration",
    "--print", "title",
    opts.url,
  ];

  const result = await execa("yt-dlp", args, { cwd: opts.output ? undefined : process.cwd() });

  const lines = result.stdout.trim().split("\n");
  const title = lines[0] ?? "unknown";
  const duration = parseFloat(lines[1] ?? "0");
  const filePath = lines[2] ?? output;

  return { filePath, title, duration };
}

/**
 * Get video info without downloading
 */
export async function getVideoInfo(url: string): Promise<{
  title: string;
  duration: number;
  description: string;
  thumbnail: string;
}> {
  const result = await execa("yt-dlp", [
    "--no-warnings",
    "--no-download",
    "--print", "title",
    "--print", "duration",
    "--print", "description",
    "--print", "thumbnail",
    url,
  ]);

  const lines = result.stdout.trim().split("\n");
  return {
    title: lines[0] ?? "",
    duration: parseFloat(lines[1] ?? "0"),
    description: lines[2] ?? "",
    thumbnail: lines[3] ?? "",
  };
}

/**
 * Check if yt-dlp is available
 */
export async function isYtDlpAvailable(): Promise<boolean> {
  try {
    await execa("yt-dlp", ["--version"]);
    return true;
  } catch {
    return false;
  }
}