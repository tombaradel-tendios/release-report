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
  const bugLines = bugs.map(b => `[${b.key}] ${unescapeHtml(b.fields.summary)}`);

  return `You are writing an internal release summary for an engineering team at a B2B SaaS company.

Release: ${release.name} (released on ${release.releaseDate})
Total tickets: ${issues.length} (${bugs.length} bugs resolved, ${nonBugs.length} other)

Non-bug tickets:
${ticketLines.join("\n")}

Bugs fixed (for the "business" text only):
${bugLines.length ? bugLines.join("\n") : "(none)"}

Write two texts in English, both using Slack mrkdwn formatting: *bold* (single asterisk), _italic_ — never **double asterisks**.

"narrative" — a concise summary for the engineering team (3–5 short paragraphs):
- Group by theme: features, infrastructure, QA, etc.
- Mention team members by first name when relevant.
- Keep tone positive and factual.
- Do NOT describe the bugs — they are listed separately below the narrative.
- Do NOT add a header line — start directly with the narrative text.

"business" — one short paragraph (2–4 sentences) for non-technical colleagues (sales, customer success, management):
- Say what customers can now do or what got better for them, in plain language.
- Mention notable customer-facing bug fixes if there are any.
- No ticket keys, no people's names, no technical jargon (no N+1, feature flags, workers, APIs, etc.).
- If the release is purely internal/technical, say so in one sentence.

Both fields are required and must be non-empty.`;
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
    const suffix = linked ? ` _(<${JIRA_BASE_URL}/browse/${linked}|${linked}>)_` : "";
    return `• <${JIRA_BASE_URL}/browse/${b.key}|${b.key}> ${unescapeHtml(b.fields.summary)}${suffix}`;
  });
  return `\n\n---\n*Resolved Bugs (${bugs.length})*\n` + (lines.length ? lines.join("\n") : "_None_");
}

export async function generateSummary(apiKey: string, release: ReleaseInfo, issues: JiraIssue[]): Promise<string> {
  const bugs = issues.filter(i => i.fields.issuetype.name === "Bug");

  const client = new Anthropic({ apiKey });
  const message = await client.beta.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [{ role: "user", content: buildPrompt(release, issues) }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            narrative: { type: "string", description: "Engineering-team release summary, 3–5 short paragraphs" },
            business: { type: "string", description: "Plain-language paragraph for non-technical colleagues, 2–4 sentences" },
          },
          required: ["narrative", "business"],
          additionalProperties: false,
        },
      },
    },
  });

  if (message.stop_reason === "refusal") {
    throw new Error(`Claude declined to summarize release ${release.name}: ${message.stop_details?.explanation ?? "no details"}`);
  }

  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map(b => b.text)
    .join("")
    .trim();
  if (!text) throw new Error(`Claude returned no text for release ${release.name}`);

  const output = JSON.parse(text) as { narrative: string; business: string };
  const narrative = toSlackMrkdwn(output.narrative.trim());
  const business  = toSlackMrkdwn(output.business.trim());

  if (!business) console.warn(`  ⚠️  Claude returned an empty business summary — section omitted.`);
  const businessSection = business ? `\n\n---\n*In short, for the business*\n${business}` : "";

  return `*Release ${release.name} · ${release.releaseDate}*\n\n${narrative}${buildBugSection(bugs)}${businessSection}`;
}
