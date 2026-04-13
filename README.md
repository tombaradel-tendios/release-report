# Release Report

Automatically generates narrative release summaries from Jira and posts them to Slack. When a new version is released in Jira, the script fetches all associated tickets, uses Claude to write a human-readable summary, and posts it to a configured Slack channel — once per release, no duplicates.

## How it works

1. Fetches the latest released version from the Jira project
2. Compares it against the last posted release (stored in `last-release-{project}.json`)
3. If new, fetches all tickets tagged with that `fixVersion`
4. Sends them to Claude to generate a narrative summary grouped by theme
5. Appends a list of resolved bugs with clickable Jira links
6. Posts the message to Slack
7. Saves the release name so it won't post again

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure credentials

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `JIRA_EMAIL` | Your Atlassian account email |
| `JIRA_API_TOKEN` | API token from [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `SLACK_BOT_TOKEN` | Bot token (`xoxb-...`) from your Slack app |
| `ANTHROPIC_API_KEY` | API key from [console.anthropic.com](https://console.anthropic.com) |

### 3. Configure targets

Edit `config.json` to define which Jira projects map to which Slack channels:

```json
[
  {
    "jiraProject": "TB",
    "slackChannel": "C0ASXFT783T"
  },
  {
    "jiraProject": "PC",
    "slackChannel": "C0ASE6SQ7MZ"
  }
]
```

You can add as many targets as needed. Each project tracks its own state independently.

> **Finding a channel ID:** In Slack, open the channel, click its name at the top, and scroll to the bottom of the panel — the ID is shown there.

### 4. Slack app permissions

Your Slack app needs the following bot token scopes:

- `chat:write` — post messages
- `chat:write.public` — post to channels the bot hasn't joined
- `channels:history` — read channel history (for cleanup)
- `channels:read` — list channels
- `channels:join` — join public channels

## Usage

### Run for all targets

```bash
npm start
```

### Run for a specific project

```bash
npm start -- --project=TB
```

### Schedule (macOS)

A `launchd` plist is included to run the script automatically every Monday at 10:00.

1. Fill in your credentials in `com.tendios.sprint-summary.plist`
2. Register it with launchd:

```bash
cp com.tendios.sprint-summary.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.tendios.sprint-summary.plist
```

Logs are written to `/tmp/sprint-summary.log` and `/tmp/sprint-summary.err`.

## Project structure

```
src/
  index.ts   — entry point, CLI args, orchestration
  jira.ts    — Jira API client
  slack.ts   — Slack API client
  prompt.ts  — Claude prompt building and summary generation
  state.ts   — last-release state persistence
  types.ts   — shared TypeScript interfaces
  utils.ts   — text helpers (HTML unescaping, Slack mrkdwn)
config.json  — target boards and channels
```
