import { Command } from "commander";
import { downloadVideo, isYtDlpAvailable } from "clip-cli-core";

export function downloadCommand(): Command {
  return new Command("download")
    .description("Download a video from YouTube/Kick/Twitch")
    .requiredOption("-u, --url <url>", "Video URL to download")
    .option("-f, --format <format>", "Video format (e.g. bestvideo[height<=1080]+bestaudio)", "bestvideo[height<=1080]+bestaudio/best[height<=1080]")
    .option("-o, --output <path>", "Output directory or file path", "./downloads")
    .option("--merge-format <format>", "Merge output format", "mp4")
    .action(async (opts) => {
      try {
        // Check yt-dlp is available
        if (!(await isYtDlpAvailable())) {
          console.error("Error: yt-dlp is not installed or not in PATH.");
          console.error("Install it: pip install yt-dlp  or  npm install -g yt-dlp");
          process.exit(1);
        }

        console.log(`Downloading: ${opts.url}`);
        console.time("download");

        const result = await downloadVideo({
          url: opts.url,
          format: opts.format,
          output: opts.output,
          mergeOutputFormat: opts.mergeFormat,
        });

        console.timeEnd("download");
        console.log(`✓ Downloaded: ${result.filePath}`);
        console.log(`  Title: ${result.title}`);
        console.log(`  Duration: ${Math.round(result.duration)}s`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}