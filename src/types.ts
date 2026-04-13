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

export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    issuetype: { name: string };
    assignee: { displayName: string } | null;
  };
}
