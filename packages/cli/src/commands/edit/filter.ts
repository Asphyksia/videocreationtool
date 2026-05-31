import { Command } from "commander";
import { editDirectory, applyFilter, applyBWFlash } from "clip-cli-core";
import ora from "ora";

export function filterEditCommand(): Command {
  return new Command("filter")
    .description("Apply visual filters and templates to clips")
    .requiredOption("-i, --input <path>", "Input directory or file")
    .option("-o, --output <dir>", "Output directory", "./output")
    .option("-f, --filter <type>", "Filter: bw, bw-flash, high-contrast, vhs, custom", "bw")
    .option("-t, --template <type>", "Template: minimal, custom", "minimal")
    .option("--logo <path>", "Logo image path for custom template")
    .option("--overlay <path>", "Overlay image path for custom template")
    .option("--font <path>", "Font file path for custom template")
    .option("--text <text>", "Text overlay for custom template")
    .option("--resolution <res>", "Output resolution (e.g. 1080x1920)", "1080x1920")
    .option("--flash-duration <seconds>", "Duration of color flash in seconds (bw-flash only)", parseFloat)
    .option("--threshold <db>", "dB above average to trigger flash (bw-flash only)", parseFloat)
    .action(async (opts) => {
      try {
        const spinner = ora(`Applying ${opts.filter} filter...`).start();
        console.time("edit");

        const fs = await import("fs/promises");
        const inputStat = await fs.stat(opts.input);
        const isDir = inputStat.isDirectory();

        if (opts.filter === "bw-flash" && !isDir) {
          // Single file bw-flash with peak detection
          const outputPath = opts.output.replace(/\/$/, "") + "/" + opts.input.split("/").pop()?.replace(".mp4", "_flash.mp4");
          await applyBWFlash({
            inputPath: opts.input,
            outputPath,
            flashDuration: opts.flashDuration ?? 1.5,
            thresholdDb: opts.threshold ?? 6,
          });
          spinner.succeed(`Applied bw-flash to ${opts.input}`);
          console.log(`  Output: ${outputPath}`);
        } else if (isDir) {
          const results = await editDirectory({
            inputDir: opts.input,
            outputDir: opts.output,
            filter: opts.filter,
            template: opts.template,
            logoPath: opts.logo,
            overlayPath: opts.overlay,
            fontPath: opts.font,
            text: opts.text,
            resolution: opts.resolution,
          });

          spinner.succeed(`Applied ${opts.filter} filter to ${results.length} clips`);
          results.forEach((r) => {
            console.log(`  ${r.outputPath}`);
          });
        } else {
          // Single file
          const result = await applyFilter(opts.input, {
            inputDir: opts.input.substring(0, opts.input.lastIndexOf("/")),
            outputDir: opts.output,
            filter: opts.filter,
            template: opts.template,
            logoPath: opts.logo,
            overlayPath: opts.overlay,
            fontPath: opts.font,
            text: opts.text,
            resolution: opts.resolution,
          });

          spinner.succeed(`Applied ${opts.filter} filter`);
          console.log(`  Output: ${result.outputPath}`);
        }

        console.timeEnd("edit");
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}