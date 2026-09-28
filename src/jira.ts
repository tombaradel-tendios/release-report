import type { ReleaseInfo, JiraIssue } from "./types.js";

const JIRA_BASE_URL = "https://tendios.atlassian.net";

// Xray test-management issue types — not product work, excluded from release summaries
const XRAY_ISSUE_TYPES = new Set(["Test", "Test Execution", "Precondition", "Test Set", "Test Plan"]);

function makeJiraClient(email: string, apiToken: string) {
  const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");

  async function get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(`${JIRA_BASE_URL}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`Jira ${path} → ${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  return { get };
}

export type JiraClient = ReturnType<typeof makeJiraClient>;
export { makeJiraClient, JIRA_BASE_URL };

export async function getLatestRelease(client: JiraClient, jiraProject: string): Promise<ReleaseInfo> {
  const versions = await client.get<ReleaseInfo[]>(`/rest/api/3/project/${jiraProject}/versions`);
  const released = versions
    .filter(v => v.released && v.releaseDate)
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
  if (!released.length) throw new Error(`No released versions found for project ${jiraProject}`);
  return released[0];
}

export async function getReleaseIssues(client: JiraClient, jiraProject: string, release: ReleaseInfo): Promise<JiraIssue[]> {
  const jql = `project = ${jiraProject} AND fixVersion = "${release.name}" ORDER BY issuetype ASC`;
  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined;
  do {
    const page = await client.get<{ issues: JiraIssue[]; nextPageToken?: string; isLast?: boolean }>("/rest/api/3/search/jql", {
      jql,
      fields: "summary,issuetype,assignee,issuelinks",
      maxResults: 100,
      ...(nextPageToken ? { nextPageToken } : {}),
    });
    issues.push(...page.issues);
    nextPageToken = page.isLast ? undefined : page.nextPageToken;
  } while (nextPageToken);
  return issues.filter(i => !XRAY_ISSUE_TYPES.has(i.fields.issuetype.name));
}
