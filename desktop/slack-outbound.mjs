// Outbound Slack posting — called from the main process only.
// The renderer passes a webhook URL (stored in settings, not in safeStorage)
// and a Block Kit payload; this module makes the actual HTTPS call.
// Webhook URLs are validated to be Slack's webhook domain before fetch.

const SLACK_WEBHOOK_ORIGIN_RE = /^https:\/\/hooks\.slack(?:-gov)?\.com\//;

/**
 * POST a Block Kit payload to a Slack incoming webhook.
 * Throws on network error or non-2xx response.
 */
export async function postSlackWebhook(webhookUrl, payload) {
  if (typeof webhookUrl !== 'string' || !SLACK_WEBHOOK_ORIGIN_RE.test(webhookUrl)) {
    throw new Error('Invalid Slack webhook URL — must start with https://hooks.slack.com/');
  }
  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Slack webhook returned ${resp.status}: ${text}`);
  }
  return { ok: true };
}
