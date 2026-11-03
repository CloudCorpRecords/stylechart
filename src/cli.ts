#!/usr/bin/env node
/**
 * stylechart CLI.
 *
 *   stylechart word_analyze '<json>'
 *   stylechart word_lookup '<json>'
 *   stylechart word_list ['<json>']
 *   stylechart style_get '<json>'
 *   stylechart word_status
 *   stylechart mcp
 *   stylechart --version
 *
 * Each tool subcommand takes one JSON argument string with
 * the tool's arguments (word_status takes none, word_list's
 * is optional) and prints the tool's result text. Exit
 * codes: 0 success, 1 runtime error, 2 usage error.
 */
import { styleGet, wordAnalyze, wordList, wordLookup, wordStatus, VERSION } from "./style.js";

const TOOL_NAMES = ["word_analyze", "word_lookup", "word_list", "style_get", "word_status"] as const;

function usage(): never {
  console.error(`Usage:
  stylechart <tool> '<json-args>'     one of: ${TOOL_NAMES.join(", ")}
  stylechart word_status
  stylechart mcp
  stylechart --version`);
  process.exit(2);
}

async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "word_analyze":
      return wordAnalyze(args as never);
    case "word_lookup":
      return wordLookup(args as never);
    case "word_list":
      return wordList(args as never);
    case "style_get":
      return styleGet(args as never);
    case "word_status":
      return wordStatus();
    default:
      usage();
  }
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    if (rest.length !== 0) usage();
    await import("./mcp.js");
    return;
  }
  if (!(TOOL_NAMES as readonly string[]).includes(cmd ?? "")) usage();
  if (cmd === "word_status") {
    if (rest.length !== 0) usage();
    try {
      const out = await runTool(cmd, {});
      console.log(out);
    } catch (err) {
      console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
    return;
  }
  if (rest.length > 1) usage();
  let args: Record<string, unknown> = {};
  if (rest.length === 1) {
    try {
      const parsed: unknown = JSON.parse(rest[0]);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) usage();
      args = parsed as Record<string, unknown>;
    } catch {
      console.error("error: argument must be a JSON object string");
      process.exit(2);
    }
  }
  try {
    const out = await runTool(cmd, args);
    console.log(out);
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
