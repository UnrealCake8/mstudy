type FirestoreDocument = {
  fields?: { count?: { integerValue?: string } };
};

type QuotaResult = {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
};

function dailyLimit() {
  const configured = Number(process.env.AI_GAMES_PER_DAY || "20");
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 20;
}

function dateKey() {
  const timeZone = process.env.AI_RATE_LIMIT_TIMEZONE || "Asia/Dubai";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function uidFromToken(token: string) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] || "", "base64url").toString("utf8")) as { sub?: string; user_id?: string };
    return payload.user_id || payload.sub || "";
  } catch {
    return "";
  }
}

async function firestoreFetch(url: string, token: string, init?: RequestInit) {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

export async function reserveAIGameQuota(request: Request): Promise<QuotaResult> {
  const token = getBearerToken(request);
  const uid = uidFromToken(token);
  if (!token || !uid) throw new Error("AUTH_REQUIRED");

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("RATE_LIMIT_NOT_CONFIGURED");

  const limit = dailyLimit();
  const day = dateKey();
  const database = `projects/${projectId}/databases/(default)`;
  const base = `https://firestore.googleapis.com/v1/${database}`;
  const documentName = `${database}/documents/users/${encodeURIComponent(uid)}/aiUsage/${day}`;
  const documentUrl = `https://firestore.googleapis.com/v1/${documentName}`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const begin = await firestoreFetch(`${base}/documents:beginTransaction`, token, {
      method: "POST",
      body: JSON.stringify({ options: { readWrite: {} } }),
    });
    if (!begin.ok) {
      if (begin.status === 401 || begin.status === 403) throw new Error("AUTH_REQUIRED");
      throw new Error("RATE_LIMIT_UNAVAILABLE");
    }
    const transaction = (await begin.json() as { transaction?: string }).transaction;
    if (!transaction) throw new Error("RATE_LIMIT_UNAVAILABLE");

    const currentResponse = await firestoreFetch(`${documentUrl}?transaction=${encodeURIComponent(transaction)}`, token);
    let used = 0;
    if (currentResponse.ok) {
      const current = await currentResponse.json() as FirestoreDocument;
      used = Number(current.fields?.count?.integerValue || 0);
    } else if (currentResponse.status !== 404) {
      if (currentResponse.status === 401 || currentResponse.status === 403) throw new Error("AUTH_REQUIRED");
      throw new Error("RATE_LIMIT_UNAVAILABLE");
    }

    if (used >= limit) {
      return { allowed: false, limit, used, remaining: 0 };
    }

    const next = used + 1;
    const commit = await firestoreFetch(`${base}/documents:commit`, token, {
      method: "POST",
      body: JSON.stringify({
        transaction,
        writes: [{
          update: {
            name: documentName,
            fields: {
              count: { integerValue: String(next) },
              date: { stringValue: day },
              updatedAt: { timestampValue: new Date().toISOString() },
            },
          },
        }],
      }),
    });

    if (commit.ok) return { allowed: true, limit, used: next, remaining: Math.max(0, limit - next) };

    const failure = await commit.text().catch(() => "");
    if (commit.status === 409 || failure.includes("ABORTED")) continue;
    if (commit.status === 401 || commit.status === 403) throw new Error("AUTH_REQUIRED");
    throw new Error("RATE_LIMIT_UNAVAILABLE");
  }

  throw new Error("RATE_LIMIT_UNAVAILABLE");
}
