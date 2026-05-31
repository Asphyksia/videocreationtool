import { Command } from "commander";

export function pipelineRunCommand(): Command {
  return new Command("run")
    .description("Run the full pipeline: download → split → score → edit → upload")
    .requiredOption("-u, --url <url>", "Video URL to download (YouTube/Kick/Twitch) OR local file path")
    .option("-n, --top <number>", "Number of best clips to select", parseInt)
    .option("-f, --filter <type>", "Filter to apply: bw, bw-flash, high-contrast, vhs, custom", "bw")
    .option("-t, --template <type>", "Template to apply: minimal, custom", "minimal")
    .option("--threshold <number>", "Scene detection sensitivity", parseFloat)
    .option("--min-length <seconds>", "Minimum clip length in seconds", parseFloat)
    .option("--max-length <seconds>", "Maximum clip length in seconds", parseFloat)
    .option("--resolution <res>", "Output resolution", "1080x1920")
    .option("-p, --platform <platforms>", "Comma-separated upload platforms", "youtube")
    .option("--title <title>", "Video title for uploads", "Clip {index}")
    .option("--tags <tags>", "Comma-separated tags", "slots,bigwin,gambling")
    .option("--no-upload", "Skip upload step (just process locally)")
    .option("--skip-download", "Skip download (use local file)")
    .option("--output <dir>", "Base output directory", "./clip-output")
    .option("--keep-intermediate", "Keep intermediate files (downloads, clips, best)")
    .action(async (opts) => {
      const {
        downloadVideo,
        isYtDlpAvailable,
        splitVideo,
        scoreClips,
        editDirectory,
        uploadVideo,
      } = await import("clip-cli-core");
      const ora = (await import("ora")).default;
      const { mkdir, rm } = await import("fs/promises");
      const { join } = await import("path");
      const { existsSync } = await import("fs");

      let videoPath: string;
      const topN = opts.top ?? 5;
      const outputBase = opts.output;

      try {
        // ─── Step 1: Download ──────────────────────────────────────────
        if (opts.skipDownload || existsSync(opts.url)) {
          videoPath = opts.url;
          console.log(`Using local file: ${videoPath}`);
        } else {
          const spinner = ora("Step 1/5: Downloading video...").start();
          if (!(await isYtDlpAvailable())) {
            spinner.fail("yt-dlp not found. Install: pip install yt-dlp");
            process.exit(1);
          }

          const result = await downloadVideo({
            url: opts.url,
            output: join(outputBase, "downloads"),
            mergeOutputFormat: "mp4",
          });
          videoPath = result.filePath;
          spinner.succeed(`Step 1/5: Downloaded "${result.title}"`);
        }

        // ─── Step 2: Split ────────────────────────────────────────────
        const spinner2 = ora("Step 2/5: Splitting into clips...").start();
        const splitResult = await splitVideo({
          input: videoPath,
          outputDir: join(outputBase, "clips"),
          method: "scenedetect",
          threshold: opts.threshold ?? 27,
          minLength: opts.minLength ?? 3,
          maxLength: opts.maxLength ?? 120,
        });
        spinner2.succeed(`Step 2/5: Split into ${splitResult.clips.length} clips`);

        // ─── Step 3: Score ─────────────────────────────────────────────
        const spinner3 = ora(`Step 3/5: Scoring clips (selecting top ${topN})...`).start();
        const scoreResult = await scoreClips({
          inputDir: join(outputBase, "clips"),
          outputDir: join(outputBase, "best"),
          top: topN,
        });
        spinner3.succeed(`Step 3/5: Selected top ${scoreResult.best.length} clips`);

        // Show ranking
        scoreResult.best.forEach((clip, i) => {
          console.log(`  ${i + 1}. ${clip.filePath.split("/").pop()} (score: ${clip.score.toFixed(2)})`);
        });

        // ─── Step 4: Edit ──────────────────────────────────────────────
        const spinner4 = ora(`Step 4/5: Applying ${opts.filter} filter...`).start();
        const editResult = await editDirectory({
          inputDir: join(outputBase, "best"),
          outputDir: join(outputBase, "output"),
          filter: opts.filter,
          template: opts.template,
          resolution: opts.resolution,
        });
        spinner4.succeed(`Step 4/5: Edited ${editResult.length} clips`);

        // ─── Step 5: Upload ────────────────────────────────────────────
        if (opts.upload !== false && !opts.noUpload) {
          const platforms = opts.platform.split(",").map((p: string) => p.trim());
          const spinner5 = ora(`Step 5/5: Uploading to ${platforms.join(", ")}...`).start();

          const { readdir } = await import("fs/promises");
          const outputFiles = (await readdir(join(outputBase, "output")))
            .filter((f: string) => f.endsWith(".mp4"));

          for (const file of outputFiles) {
            for (const platform of platforms) {
              try {
                await uploadVideo({
                  videoPath: join(outputBase, "output", file),
                  platform,
                  title: opts.title.replace("{index}", file),
                  tags: opts.tags.split(",").map((t: string) => t.trim()),
                });
              } catch (err: any) {
                console.error(`  Failed to upload ${file} to ${platform}: ${err.message}`);
              }
            }
          }
          spinner5.succeed("Step 5/5: Upload complete");
        } else {
          console.log("Step 5/5: Skipped upload (--no-upload)");
        }

        // ─── Cleanup ───────────────────────────────────────────────────
        if (!opts.keepIntermediate) {
          console.log("\nCleaning up intermediate files...");
          await rm(join(outputBase, "clips"), { recursive: true, force: true });
          await rm(join(outputBase, "best"), { recursive: true, force: true });
          if (!opts.skipDownload) {
            await rm(join(outputBase, "downloads"), { recursive: true, force: true });
          }
        }

        console.log(`\n✓ Pipeline complete! Output: ${join(outputBase, "output")}`);
      } catch (err: any) {
        console.error(`\nPipeline failed: ${err.message}`);
        process.exit(1);
      }
    });
}