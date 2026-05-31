/**
 * clip-cli-core: Upload videos to social media platforms
 * 
 * YouTube: Official Data API v3 (OAuth2)
 * TikTok: Browser automation via Playwright (API limited to Business accounts)
 * Instagram: Graph API (Business accounts only)
 */

import { execa } from "execa";
import { readFile } from "fs/promises";

export interface UploadOptions {
  videoPath: string;
  platform: "youtube" | "tiktok" | "instagram";
  title?: string;
  description?: string;
  tags?: string[];
  madeForKids?: boolean;
  // Instagram-specific
  caption?: string;
  // TikTok-specific
  commentPrivacy?: "public" | "friends" | "private";
  duetEnabled?: boolean;
  stitchEnabled?: boolean;
}

export interface UploadResult {
  platform: string;
  videoId: string;
  url: string;
  status: "uploaded" | "processing" | "failed";
}

// ─── YouTube Upload ──────────────────────────────────────────────────

export async function uploadToYouTube(opts: UploadOptions): Promise<UploadResult> {
  // Uses YouTube Data API v3 via google-api-python-client
  // Requires OAuth2 credentials configured via `clip auth login`
  
  const args = [
    "clip-cli-upload",
    "youtube",
    "--file", opts.videoPath,
    "--title", opts.title ?? "",
    "--description", opts.description ?? "",
    "--tags", (opts.tags ?? []).join(","),
    "--category", "22", // People & Blogs
    "--privacy", "public",
    "--no-made-for-kids",
  ];

  // This delegates to a Python script that handles OAuth2 flow
  const result = await execa("python3", [
    joinScripts("youtube_upload.py"),
    opts.videoPath,
    opts.title ?? "Clip",
    opts.description ?? "",
    (opts.tags ?? []).join(","),
  ]);

  const videoId = result.stdout.trim();
  return {
    platform: "youtube",
    videoId,
    url: `https://youtube.com/shorts/${videoId}`,
    status: "uploaded",
  };
}

// ─── TikTok Upload (browser automation) ──────────────────────────────

export async function uploadToTikTok(opts: UploadOptions): Promise<UploadResult> {
  // Uses Playwright to automate upload through TikTok's web interface
  // This is necessary because TikTok's Content Posting API is very restrictive
  
  const args = [
    joinScripts("tiktok_upload.py"),
    opts.videoPath,
    opts.title ?? "",
    (opts.tags ?? []).join(","),
  ];

  const result = await execa("python3", args);
  const videoId = result.stdout.trim();
  
  return {
    platform: "tiktok",
    videoId,
    url: `https://tiktok.com/@user/video/${videoId}`,
    status: "uploaded",
  };
}

// ─── Instagram Reels Upload ──────────────────────────────────────────

export async function uploadToInstagram(opts: UploadOptions): Promise<UploadResult> {
  // Uses Instagram Graph API (requires Business/Creator account)
  const args = [
    joinScripts("instagram_upload.py"),
    opts.videoPath,
    opts.caption ?? opts.title ?? "",
  ];

  const result = await execa("python3", args);
  const mediaId = result.stdout.trim();

  return {
    platform: "instagram",
    videoId: mediaId,
    url: `https://instagram.com/reel/${mediaId}`,
    status: "uploaded",
  };
}

// ─── Generic upload dispatcher ────────────────────────────────────────

export async function uploadVideo(opts: UploadOptions): Promise<UploadResult> {
  switch (opts.platform) {
    case "youtube":
      return uploadToYouTube(opts);
    case "tiktok":
      return uploadToTikTok(opts);
    case "instagram":
      return uploadToInstagram(opts);
    default:
      throw new Error(`Unsupported platform: ${opts.platform}`);
  }
}

function joinScripts(name: string): string {
  // Scripts are located in packages/core/scripts/
  return require("path").join(__dirname, "..", "scripts", name);
}