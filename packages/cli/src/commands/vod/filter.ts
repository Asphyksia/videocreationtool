import { Command } from "commander";

export function filterCommand(): Command {
  return new Command("filter")
    .description("Apply filters to clips (alias for clip edit filter)")
    .action(() => {
      console.log("Use 'clip edit filter' instead.");
      process.exit(1);
    });
}