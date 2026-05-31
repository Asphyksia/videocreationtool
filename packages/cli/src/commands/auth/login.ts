import { Command } from "commander";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR = join(homedir(), ".clip-cli");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG = {
  youtube: {
    client_secrets_file: "",
    access_token: "",
    refresh_token: "",
  },
  tiktok: {
    session_id: "",
  },
  instagram: {
    access_token: "",
    business_account_id: "",
  },
  defaults: {
    top_clips: 5,
    scene_threshold: 27,
    min_clip_seconds: 3,
    max_clip_seconds: 120,
    filter: "bw",
    template: "minimal",
    resolution: "1080x1920",
    platforms: "youtube",
  },
  templates: {
    custom: {
      logo: "",
      overlay: "",
      font: "",
      text: "",
    },
  },
};

async function loadConfig(): Promise<any> {
  try {
    const data = await readFile(CONFIG_FILE, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

async function saveConfig(config: any): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function authLoginCommand(): Command {
  return new Command("login")
    .description("Configure authentication for a platform")
    .option("-p, --platform <platform>", "Platform: youtube, tiktok, instagram", "youtube")
    .option("--client-secrets <path>", "YouTube OAuth2 client secrets JSON file")
    .option("--access-token <token>", "Access token (Instagram/TikTok)")
    .option("--business-account-id <id>", "Business account ID (Instagram)")
    .option("--session-id <id>", "TikTok session ID")
    .action(async (opts) => {
      try {
        const config = await loadConfig();

        switch (opts.platform) {
          case "youtube":
            if (opts.clientSecrets) {
              config.youtube.client_secrets_file = opts.clientSecrets;
            } else {
              console.log("\nYouTube OAuth2 Setup:");
              console.log("1. Go to https://console.cloud.google.com/");
              console.log("2. Create a project and enable YouTube Data API v3");
              console.log("3. Create OAuth2 credentials (Desktop app)");
              console.log("4. Download the client_secrets.json file");
              console.log("5. Run: clip auth login --platform youtube --client-secrets <path>\n");
              return;
            }
            break;

          case "tiktok":
            if (opts.sessionId) {
              config.tiktok.session_id = opts.sessionId;
              console.log("✓ TikTok session ID saved. First upload will open browser for login.");
            } else {
              console.log("\nTikTok Upload Setup:");
              console.log("TikTok uses browser automation (Playwright).");
              console.log("On first upload, a browser window will open for you to log in.\n");
              return;
            }
            break;

          case "instagram":
            if (opts.accessToken) {
              config.instagram.access_token = opts.accessToken;
              config.instagram.business_account_id = opts.businessAccountId ?? "";
              console.log("✓ Instagram credentials saved.");
            } else {
              console.log("\nInstagram Reels Upload Setup:");
              console.log("1. You need a Facebook Developer App with Instagram Graph API");
              console.log("2. Your Instagram account must be a Business/Creator account");
              console.log("3. Get your access token and business account ID from Facebook");
              console.log("4. Run: clip auth login --platform instagram --access-token <token> --business-account-id <id>\n");
              return;
            }
            break;

          default:
            console.error(`Unknown platform: ${opts.platform}. Use youtube, tiktok, or instagram.`);
            process.exit(1);
        }

        await saveConfig(config);
        console.log("✓ Configuration saved to " + CONFIG_FILE);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}

export function authStatusCommand(): Command {
  return new Command("status")
    .description("Show authentication status for all platforms")
    .action(async () => {
      try {
        const config = await loadConfig();

        const platforms = [
          {
            name: "YouTube",
            configured: !!(config.youtube?.client_secrets_file),
            details: config.youtube?.client_secrets_file ? "✓ Client secrets configured" : "✗ Not configured",
          },
          {
            name: "TikTok",
            configured: !!(config.tiktok?.session_id),
            details: "Uses browser automation (Playwright)",
          },
          {
            name: "Instagram",
            configured: !!(config.instagram?.access_token),
            details: config.instagram?.access_token ? "✓ Access token configured" : "✗ Not configured",
          },
        ];

        console.log("\nAuthentication Status:\n");
        for (const p of platforms) {
          const icon = p.configured ? "✓" : "✗";
          console.log(`  ${icon} ${p.name}: ${p.details}`);
        }
        console.log();
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}