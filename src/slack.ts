export function makeSlackClient(botToken: string) {
  async function postMessage(channel: string, text: string): Promise<string> {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel, text }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string; channel: string; ts: string };
    if (!data.ok) throw new Error(`Slack error: ${data.error}`);
    return data.ts;
  }

  return { postMessage };
}

export type SlackClient = ReturnType<typeof makeSlackClient>;
