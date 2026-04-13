import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const stateFile = (jiraProject: string): string =>
  join(process.cwd(), `last-release-${jiraProject}.json`);

export function getLastPostedRelease(jiraProject: string): string | null {
  const file = stateFile(jiraProject);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf-8")).lastRelease ?? null;
  } catch {
    return null;
  }
}

export function saveLastPostedRelease(jiraProject: string, releaseName: string): void {
  writeFileSync(stateFile(jiraProject), JSON.stringify({ lastRelease: releaseName }, null, 2));
}
