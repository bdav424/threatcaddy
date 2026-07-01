// desktop/slack-sync.mjs
//
// Slack Web API polling for direct messages (IMs).
// Called by main.mjs IPC handler — token is decrypted from safeStorage and never exposed.
//
// Returns an array of SlackDmThread (see SlackDmThread shape below).
// Caller writes the result to localStorage via a webContents.send() so the renderer
// can pick it up without re-crossing the IPC boundary.

const CONVERSATIONS_LIST = 'https://slack.com/api/conversations.list';
const CONVERSATIONS_HIST  = 'https://slack.com/api/conversations.history';
const USERS_INFO          = 'https://slack.com/api/users.info';

/**
 * Fetch all open IM channels and return recent messages from each.
 *
 * @param {string} userToken  Slack user token (xoxp-...)
 * @param {number} sinceTs    Unix seconds; only fetch messages newer than this.
 *                            Defaults to 8 hours ago so we surface today's DMs on first poll.
 * @returns {Promise<SlackDmThread[]>}
 */
export async function pollSlackDMs(userToken, sinceTs) {
  const oldest = sinceTs ?? Math.floor((Date.now() - 8 * 3_600_000) / 1000).toString();

  // 1. List IM channels
  const listResp = await slackGet(CONVERSATIONS_LIST, userToken, {
    types:            'im',
    exclude_archived: 'true',
    limit:            '200',
  });
  if (!listResp.ok) return [];

  const channels = listResp.channels ?? [];
  if (channels.length === 0) return [];

  // 2. Fetch recent history from each channel (parallel, capped)
  const userCache = new Map();
  const threads = (
    await Promise.allSettled(
      channels.map((ch) => fetchDmThread(userToken, ch, oldest, userCache)),
    )
  )
    .filter((r) => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value);

  return threads;
}

async function fetchDmThread(userToken, channel, oldest, userCache) {
  const histResp = await slackGet(CONVERSATIONS_HIST, userToken, {
    channel: channel.id,
    oldest:  oldest.toString(),
    limit:   '20',
    inclusive: 'false',
  });
  if (!histResp.ok || !histResp.messages?.length) return null;

  // Slack IM: the "user" field on the channel IS the other person's userId
  const userId = channel.user;
  if (!userId || userId === 'USLACKBOT') return null;

  const userInfo = await resolveUser(userToken, userId, userCache);

  const lastMsg   = histResp.messages[0]; // newest first
  const unreadCount = histResp.messages.length;

  return {
    channelId:       channel.id,
    userId,
    senderName:      userInfo.name,
    senderAvatar:    userInfo.avatar,
    unreadCount,
    lastMessageText: lastMsg.text ?? '',
    lastMessageTs:   lastMsg.ts ?? '',
    polledAt:        new Date().toISOString(),
    slackDeepLink:   `slack://user?team=${userInfo.teamId ?? ''}&id=${userId}`,
  };
}

async function resolveUser(userToken, userId, cache) {
  if (cache.has(userId)) return cache.get(userId);
  try {
    const resp = await slackGet(USERS_INFO, userToken, { user: userId });
    const user = resp.user ?? {};
    const info = {
      name:   user.real_name ?? user.name ?? userId,
      avatar: user.profile?.image_48 ?? user.profile?.image_32 ?? undefined,
      teamId: user.team_id ?? undefined,
    };
    cache.set(userId, info);
    return info;
  } catch {
    const fallback = { name: userId, avatar: undefined, teamId: undefined };
    cache.set(userId, fallback);
    return fallback;
  }
}

async function slackGet(url, token, params = {}) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const resp = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return resp.json();
}
