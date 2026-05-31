#!/usr/bin/env node
/**
 * clip-cli: CLI entry point
 * 
 * Download gambling compilations, split into individual plays,
 * apply edits (B&W, templates), and upload to social media.
 */

import { Command } from "commander";
import { downloadCommand } from "./commands/vod/download.js";
import { splitCommand } from "./commands/vod/split.js";
import { scoreCommand } from "./commands/vod/score.js";
import { filterCommand } from "./commands/vod/filter.js";
import { authLoginCommand } from "./commands/auth/login.js";
import { authStatusCommand } from "./commands/auth/status.js";
import { configSetCommand } from "./commands/config/set.js";
import { configShowCommand } from "./commands/config/show.js";
import { pipelineRunCommand } from "./commands/pipeline/run.js";
import { filterEditCommand } from "./commands/edit/filter.js";
import { uploadCommand } from "./commands/upload/upload.js";

const program = new Command();

program
  .name("clip")
  .description("CLI for downloading, splitting, editing, and uploading gambling compilation clips")
  .version("0.1.0");

// ─── Auth commands ─────────────────────────────────────────────────────
const auth = program.command("auth").description("Manage authentication credentials");
auth.addCommand(authLoginCommand());
auth.addCommand(authStatusCommand());

// ─── Config commands ───────────────────────────────────────────────────
const config = program.command("config").description("Manage configuration");
config.addCommand(configSetCommand());
config.addCommand(configShowCommand());

// ─── VOD commands ───────────────────────────────────────────────────────
const vod = program.command("vod").description("Download, split, and score video content");
vod.addCommand(downloadCommand());
vod.addCommand(splitCommand());
vod.addCommand(scoreCommand());

// ─── Edit commands ──────────────────────────────────────────────────────
const edit = program.command("edit").description("Apply filters and templates to clips");
edit.addCommand(filterEditCommand());

// ─── Upload commands ────────────────────────────────────────────────────
program.addCommand(uploadCommand());

// ─── Pipeline command ───────────────────────────────────────────────────
program.addCommand(pipelineRunCommand());

program.parse();