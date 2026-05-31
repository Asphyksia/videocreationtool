/**
 * clip-cli-core: Main exports
 */

export { downloadVideo, getVideoInfo, isYtDlpAvailable } from "./vod/download.js";
export type { DownloadOptions, DownloadResult } from "./vod/download.js";

export { detectScenes, splitVideo, checkSplitDeps } from "./vod/split.js";
export type { SplitOptions, SplitResult, SceneBoundary } from "./vod/split.js";

export { scoreClips, analyzeAudioPeak } from "./vod/score.js";
export type { ScoreOptions, ScoreResult, ClipScore } from "./vod/score.js";

export { applyFilter, applyBWFlash, editDirectory } from "./edit/filters.js";
export type { FilterType, TemplateType, EditOptions, EditResult, BWFlashOptions } from "./edit/filters.js";

export { uploadVideo, uploadToYouTube, uploadToTikTok, uploadToInstagram } from "./upload/index.js";
export type { UploadOptions, UploadResult } from "./upload/index.js";