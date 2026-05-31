import { Command } from "commander";
import { scoreClips } from "clip-cli-core";
import ora from "ora";

export function scoreCommand(): Command {
  return new Command("score")
    .description("Score and rank clips by emotional intensity (audio peaks)")
    .requiredOption("-d, --dir <directory>", "Directory containing clip files")
    .option("-o, --output <dir>", "Output directory for best clips", "./best")
    .option("-n, --top <number>", "Number of top clips to select", parseInt)
    .option("-m, --method <method>", "Scoring method: audio-peaks or all", "audio-peaks")
    .action(async (opts) => {
      try {
        const spinner = ora("Analyzing audio peaks...").start();
        console.time("score");

        const result = await scoreClips({
          inputDir: opts.dir,
          outputDir: opts.output,
          top: opts.top ?? 5,
          method: opts.method,
        });

        spinner.succeed(`Scored ${result.clips.length} clips, selected top ${result.best.length}`);
        console.timeEnd("score");

        console.log("\nAll clips (ranked):");
        result.clips.forEach((clip, i) => {
          const bar = "█".repeat(Math.round(clip.score * 20));
          console.log(`  ${String(i + 1).padStart(3, "0")}. ${clip.filePath.split("/").pop()} score=${clip.score.toFixed(2)} peak=${clip.peakDb.toFixed(1)}dB ${bar}`);
        });

        console.log(`\n✓ Top ${result.best.length} clips copied to: ${result.outputDir}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}