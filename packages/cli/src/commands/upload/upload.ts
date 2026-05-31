import { Command } from "commander";
import { uploadVideo } from "clip-cli-core";
import { readdir } from "fs/promises";
import { join, extname } from "path";
import ora from "ora";

export function uploadCommand(): Command {
  return new Command("upload")
    .description("Upload processed clips to social media platforms")
    .requiredOption("-d, --dir <directory>", "Directory containing video files to upload")
    .option("-p, --platform <platforms>", "Comma-separated platforms: youtube,tiktok,instagram", "youtube")
    .option("--title <title>", "Video title (supports {index} placeholder)", "Clip {index}")
    .option("--description <desc>", "Video description", "")
    .option("--tags <tags>", "Comma-separated tags", "slots,bigwin,gambling")
    .option("--caption <caption>", "Caption for Instagram Reels (falls back to title)", "")
    .action(async (opts) => {
      try {
        const platforms = opts.platform.split(",").map((p: string) => p.trim());
        const videoExts = [".mp4", ".mkv", ".avi", ".mov"];

        // Find video files
        const files = (await readdir(opts.dir)).filter((f: string) =>
          videoExts.includes(extname(f).toLowerCase())
        );

        if (files.length === 0) {
          console.error(`No video files found in ${opts.dir}`);
          process.exit(1);
        }

        console.log(`Found ${files.length} video(s) to upload to: ${platforms.join(", ")}`);

        for (const file of files) {
          const filePath = join(opts.dir, file);

          for (const platform of platforms) {
            const spinner = ora(`Uploading ${file} to ${platform}...`).start();

            try {
              const result = await uploadVideo({
                videoPath: filePath,
                platform: platform as "youtube" | "tiktok" | "instagram",
                title: opts.title.replace("{index}", file),
                description: opts.description,
                tags: opts.tags.split(",").map((t: string) => t.trim()),
                caption: opts.caption || opts.title,
              });

              spinner.succeed(`Uploaded to ${platform}: ${result.url}`);
            } catch (err: any) {
              spinner.fail(`Failed to upload to ${platform}: ${err.message}`);
            }
          }
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}