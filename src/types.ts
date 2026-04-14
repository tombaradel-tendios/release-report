export interface TargetConfig {
  jiraProject: string;
  slackChannel: string;
}

export interface ReleaseInfo {
  id: string;
  name: string;
  releaseDate: string;
  released: boolean;
}

export interface IssueLink {
  inwardIssue?: { key: string };
  outwardIssue?: { key: string };
}

export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    issuetype: { name: string };
    assignee: { displayName: string } | null;
    issuelinks: IssueLink[];
  };
}
