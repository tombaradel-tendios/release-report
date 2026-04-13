export function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function toSlackMrkdwn(text: string): string {
  return unescapeHtml(text).replace(/\*\*(.+?)\*\*/g, "*$1*");
}
