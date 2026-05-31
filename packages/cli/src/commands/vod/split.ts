import { Command } from "commander";
import { splitVideo, checkSplitDeps } from "clip-cli-core";
import ora from "ora";

export function splitCommand(): Command {
  return new Command("split")
    .description("Split a video into individual clips using scene detection")
    .requiredOption("-i, --input <file>", "Input video file")
    .option("-o, --output <dir>", "Output directory for clips", "./clips")
    .option("-m, --method <method>", "Detection method: scenedetect, ffmpeg, silence", "scenedetect")
    .option("-t, --threshold <number>", "Scene detection sensitivity (lower = more cuts)", parseFloat)
    .option("--min-length <seconds>", "Minimum clip length in seconds", parseFloat)
    .option("--max-length <seconds>", "Maximum clip length in seconds", parseFloat)
    .action(async (opts) => {
      try {
        // Check dependencies
        const deps = await checkSplitDeps();
        if (!deps.ffmpeg) {
          console.error("Error: ffmpeg is not installed or not in PATH.");
          process.exit(1);
        }
        if (opts.method === "scenedetect" && !deps.scenedetect) {
          console.error("Error: scenedetect is not installed.");
          console.error("Install it: pip install scenedetect[opencv]");
          process.exit(1);
        }

        const spinner = ora("Detecting scene boundaries...").start();
        console.time("split");

        const result = await splitVideo({
          input: opts.input,
          outputDir: opts.output,
          method: opts.method,
          threshold: opts.threshold ?? 27,
          minLength: opts.minLength ?? 3,
          maxLength: opts.maxLength ?? 120,
        });

        spinner.succeed(`Found ${result.clips.length} clips`);
        console.timeEnd("split");

        console.log("\nClips:");
        result.clips.forEach((clip, i) => {
          console.log(`  ${String(i + 1).padStart(3, "0")}. ${clip.filePath} (${clip.duration.toFixed(1)}s, ${clip.startTime.toFixed(1)}s-${clip.endTime.toFixed(1)}s)`);
        });

        console.log(`\nOutput directory: ${result.outputDir}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}