import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import type { TargetConfig } from "./types.js";
import { makeJiraClient, getLatestRelease, getReleaseIssues } from "./jira.js";
import { makeSlackClient } from "./slack.js";
import { generateSummary } from "./prompt.js";
import { getLastPostedRelease, saveLastPostedRelease } from "./state.js";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function loadTargets(projectFilter?: string): TargetConfig[] {
  const all: TargetConfig[] = JSON.parse(
    readFileSync(join(process.cwd(), "config.json"), "utf-8")
  );
  if (!projectFilter) return all;
  const filtered = all.filter(t => t.jiraProject === projectFilter);
  if (!filtered.length) throw new Error(`No target found for project "${projectFilter}"`);
  return filtered;
}

async function processTarget(
  target: TargetConfig,
  jira: ReturnType<typeof makeJiraClient>,
  slack: ReturnType<typeof makeSlackClient>,
  anthropicKey: string
): Promise<void> {
  console.log(`\n── Project: ${target.jiraProject} ──`);

  const release = await getLatestRelease(jira, target.jiraProject);
  console.log(`  Latest release: ${release.name} (${release.releaseDate})`);

  if (getLastPostedRelease(target.jiraProject) === release.name) {
    console.log(`  Already posted release ${release.name} — skipping.`);
    return;
  }

  const issues = await getReleaseIssues(jira, target.jiraProject, release);
  const bugCount = issues.filter(i => i.fields.issuetype.name === "Bug").length;
  console.log(`  Issues: ${issues.length} (${bugCount} bugs)`);

  const summary = await generateSummary(anthropicKey, release, issues);
  const ts = await slack.postMessage(target.slackChannel, summary);
  console.log(`  Posted to #${target.slackChannel} (ts=${ts})`);

  saveLastPostedRelease(target.jiraProject, release.name);
}

async function main(): Promise<void> {
  const jira  = makeJiraClient(requireEnv("JIRA_EMAIL"), requireEnv("JIRA_API_TOKEN"));
  const slack = makeSlackClient(requireEnv("SLACK_BOT_TOKEN"));
  const anthropicKey = requireEnv("ANTHROPIC_API_KEY");

  const projectFilter = process.argv.find(a => a.startsWith("--project="))?.split("=")[1];
  const targets = loadTargets(projectFilter);

  console.log(`Running for ${targets.length} target(s)${projectFilter ? ` (filtered: ${projectFilter})` : ""}…`);

  for (const target of targets) {
    await processTarget(target, jira, slack, anthropicKey);
  }

  console.log("\nDone.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
