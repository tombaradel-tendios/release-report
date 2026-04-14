import Anthropic from "@anthropic-ai/sdk";
import type { ReleaseInfo, JiraIssue } from "./types.js";
import { unescapeHtml, toSlackMrkdwn } from "./utils.js";
import { JIRA_BASE_URL } from "./jira.js";

function buildPrompt(release: ReleaseInfo, issues: JiraIssue[]): string {
  const bugs    = issues.filter(i => i.fields.issuetype.name === "Bug");
  const nonBugs = issues.filter(i => i.fields.issuetype.name !== "Bug");

  const ticketLines = nonBugs.map(i => {
    const assignee = i.fields.assignee?.displayName ?? "Unassigned";
    return `[${i.key}] (${i.fields.issuetype.name}) ${unescapeHtml(i.fields.summary)} — ${assignee}`;
  });

  return `You are writing an internal release summary for an engineering team at a B2B SaaS company.

Release: ${release.name} (released on ${release.releaseDate})
Total tickets: ${issues.length} (${bugs.length} bugs resolved, ${nonBugs.length} other)

Non-bug tickets:
${ticketLines.join("\n")}

Write a concise narrative summary in English (3–5 short paragraphs).
- Use Slack mrkdwn formatting: *bold* (single asterisk), _italic_ — never **double asterisks**.
- Group by theme: features, infrastructure, QA, etc.
- Mention team members by first name when relevant.
- Keep tone positive and factual.
- Do NOT include the bug list (it will be appended separately).
- Do NOT add a header line — start directly with the narrative text.`;
}

function getLinkedKey(bug: JiraIssue): string | null {
  for (const link of bug.fields.issuelinks ?? []) {
    const linked = link.inwardIssue ?? link.outwardIssue;
    if (linked) return linked.key;
  }
  return null;
}

function buildBugSection(bugs: JiraIssue[]): string {
  const lines = bugs.map(b => {
    const linked = getLinkedKey(b);
    const suffix = linked ? ` _(${linked})_` : "";
    return `• <${JIRA_BASE_URL}/browse/${b.key}|${b.key}> ${unescapeHtml(b.fields.summary)}${suffix}`;
  });
  return `\n\n---\n*Resolved Bugs (${bugs.length})*\n` + (lines.length ? lines.join("\n") : "_None_");
}

export async function generateSummary(apiKey: string, release: ReleaseInfo, issues: JiraIssue[]): Promise<string> {
  const bugs = issues.filter(i => i.fields.issuetype.name === "Bug");

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: buildPrompt(release, issues) }],
  });

  const narrative = toSlackMrkdwn((message.content[0] as { text: string }).text.trim());

  return `*Release ${release.name} · ${release.releaseDate}*\n\n${narrative}${buildBugSection(bugs)}`;
}
