import { Command } from "commander";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR = join(homedir(), ".clip-cli");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export function configSetCommand(): Command {
  return new Command("set")
    .description("Set a configuration value")
    .argument("<key>", "Config key (dot notation, e.g. templates.custom.logo)")
    .argument("<value>", "Config value")
    .action(async (key: string, value: string) => {
      try {
        let config: any = {};
        try {
          config = JSON.parse(await readFile(CONFIG_FILE, "utf-8"));
        } catch { /* empty config */ }

        // Set nested key
        const parts = key.split(".");
        let obj = config;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!obj[parts[i]]) obj[parts[i]] = {};
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]!] = value;

        await mkdir(CONFIG_DIR, { recursive: true });
        await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
        console.log(`✓ Set ${key} = ${value}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}

export function configShowCommand(): Command {
  return new Command("show")
    .description("Show current configuration")
    .action(async () => {
      try {
        const data = await readFile(CONFIG_FILE, "utf-8");
        console.log(JSON.stringify(JSON.parse(data), null, 2));
      } catch {
        console.log("No configuration found. Run 'clip auth login' to get started.");
      }
    });
}