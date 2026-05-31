/**
 * clip-cli-core: System capability detection
 * 
 * Detects hardware capabilities: GPU, NVENC, CUDA, RAM
 * for automatic optimization preset selection.
 */

import { execa } from "execa";

export interface SystemCapabilities {
  hasNVENC: boolean;
  hasCUDA: boolean;
  hasCuvidDecode: boolean;
  hasGPU: boolean;
  gpuName?: string;
  gpuMemoryMB?: number;
  totalRamMB: number;
  cpuCores: number;
  recommendedPreset: "high" | "balanced" | "low";
}

let cachedCapabilities: SystemCapabilities | null = null;

export async function detectSystemCapabilities(): Promise<SystemCapabilities> {
  if (cachedCapabilities) return cachedCapabilities;

  const caps: SystemCapabilities = {
    hasNVENC: false,
    hasCUDA: false,
    hasCuvidDecode: false,
    hasGPU: false,
    totalRamMB: 0,
    cpuCores: 1,
    recommendedPreset: "balanced",
  };

  // ─── Detect GPU via nvidia-smi (must run before NVENC check) ─────
  try {
    const smi = await execa("nvidia-smi", [
      "--query-gpu=name,memory.total,driver_version",
      "--format=csv,noheader,nounits",
    ], { reject: false });
    const parts = smi.stdout.trim().split(",").map((s: string) => s.trim());
    const name = parts[0];
    const mem = parts[1];
    const driverVer = parseFloat(parts[2] ?? "0") || 0;
    if (name) {
      caps.hasGPU = true;
      caps.gpuName = name ?? undefined;
      caps.gpuMemoryMB = parseInt(mem ?? "0", 10) || 0;
    }
  } catch { /* no nvidia-smi */ }

  // ─── Detect NVENC encoder ──────────────────────────────────────────
  try {
    const enc = await execa("ffmpeg", ["-encoders"], { reject: false });
    const hasNVENCEncoder = enc.stdout.includes("h264_nvenc") || enc.stderr.includes("h264_nvenc");

    if (hasNVENCEncoder) {
      // Check NVIDIA driver version for NVENC compatibility
      if (caps.hasGPU) {
        const smi = await execa("nvidia-smi", [
          "--query-gpu=driver_version",
          "--format=csv,noheader",
        ], { reject: false });
        const driverVer = parseFloat(smi.stdout.trim()) || 0;
        // NVENC requires driver >= 435 for modern API
        caps.hasNVENC = driverVer >= 435;
      } else {
        caps.hasNVENC = true;  // No GPU info, assume it works
      }
    }

    caps.hasCUDA = enc.stdout.includes("h264_cuvid");
    caps.hasCuvidDecode = enc.stdout.includes("h264_cuvid");
  } catch { /* ffmpeg not available */ }

  // ─── Detect RAM ────────────────────────────────────────────────────
  try {
    const meminfo = await execa("awk", [
      "/MemTotal/ {printf \"%d\", $2/1024}",
      "/proc/meminfo",
    ], { reject: false });
    caps.totalRamMB = parseInt(meminfo.stdout, 10) || 0;
  } catch { /* fallback */ }

  // ─── Detect CPU cores ──────────────────────────────────────────────
  try {
    const nproc = await execa("nproc", { reject: false });
    caps.cpuCores = parseInt(nproc.stdout.trim(), 10) || 1;
  } catch { /* fallback */ }

  // ─── Auto-recommend preset ─────────────────────────────────────────
  if (caps.hasGPU && caps.hasNVENC && caps.totalRamMB >= 8000) {
    caps.recommendedPreset = "high";
  } else if (caps.totalRamMB >= 6000 || caps.hasNVENC) {
    caps.recommendedPreset = "balanced";
  } else {
    caps.recommendedPreset = "low";
  }

  cachedCapabilities = caps;
  return caps;
}

export function getEncoder(opts: { hasNVENC: boolean; preset?: string }): {
  videoCodec: string;
  preset: string;
  crf: string;
  extraArgs: string[];
} {
  if (opts.hasNVENC) {
    // NVENC has different presets: p1 (fastest) through p7 (slowest)
    const nvencPreset = opts.preset === "low" ? "p1" : opts.preset === "balanced" ? "p3" : "p4";
    return {
      videoCodec: "h264_nvenc",
      preset: nvencPreset,
      crf: opts.preset === "low" ? "30" : opts.preset === "balanced" ? "26" : "23",
      extraArgs: ["-cq", opts.preset === "low" ? "30" : opts.preset === "balanced" ? "26" : "23", "-rc", "vbr"],
    };
  }
  
  // CPU encoding fallback
  return {
    videoCodec: "libx264",
    preset: opts.preset === "low" ? "ultrafast" : opts.preset === "balanced" ? "fast" : "medium",
    crf: opts.preset === "low" ? "30" : opts.preset === "balanced" ? "26" : "23",
    extraArgs: [],
  };
}

export interface PresetConfig {
  downloadFormat: string;
  splitMethod: "scenedetect" | "ffmpeg";
  splitThreshold: number;
  downscale: number;
  minLength: number;
  resolution: string;
  audioBitrate: string;
  isLowMem: boolean;
}

export const PRESETS: Record<string, PresetConfig> = {
  high: {
    downloadFormat: "bestvideo[height<=1080][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]",
    splitMethod: "scenedetect",
    splitThreshold: 27,
    downscale: 1,
    minLength: 3,
    resolution: "1080x1920",
    audioBitrate: "192k",
    isLowMem: false,
  },
  balanced: {
    downloadFormat: "bestvideo[height<=720][vcodec^=avc1]+bestaudio[ext=m4a]/best[height<=720]",
    splitMethod: "scenedetect",
    splitThreshold: 27,
    downscale: 2,
    minLength: 3,
    resolution: "1080x1920",
    audioBitrate: "128k",
    isLowMem: false,
  },
  low: {
    downloadFormat: "bestvideo[height<=480][vcodec^=avc1]+bestaudio[ext=m4a]/best[height<=480]",
    splitMethod: "ffmpeg",
    splitThreshold: 0.3,
    downscale: 4,
    minLength: 2,
    resolution: "720x1280",
    audioBitrate: "96k",
    isLowMem: true,
  },
};
