// ─────────────────────────────────────────────────────────────────────────────
// JBN API — /api/stats.js
// Returns live counts for the dashboard stat cards.
// Response: { members: N, mentors: N, industries: N }
//
// Mentor detection: DirectoryRole === "Mentor" (same field used by Directory Code)
// Member count: all active/trialing accounts (regardless of PublicDirectoryListing)
// Industries: unique DirectoryCategories values across all active/trialing members
//
// ⚠️ OUTSETA PAGINATION QUIRK:
//   offset = PAGE INDEX (0, 1, 2…) — NOT a record skip value.
//   Use metadata.total to calculate total pages and loop accordingly.
//   Use /crm/people (NOT /crm/accounts — that returns person fields as null).
// ─────────────────────────────────────────────────────────────────────────────

// In-memory cache — persists across warm Vercel function invocations
let cachedData = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.jbnphilly.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // Return cached response if still fresh
  if (cachedData && (Date.now() - cacheTimestamp < CACHE_TTL)) {
    return res.status(200).json(cachedData);
  }

  const auth = 'Outseta ' + process.env.OUTSETA_API_KEY + ':' + process.env.OUTSETA_API_SECRET;
  const base = 'https://jbnphilly.outseta.com/api/v1';
  const PAGE_SIZE = 25;
  // Minimal field set — only what's needed for counting
  const fields = 'Uid,MembershipStatus,DirectoryCategories,DirectoryRole,PersonAccount,PersonAccount.Account.AccountStageLabel';

  try {
    // Fetch first page + read total from metadata
    const firstRes = await fetch(
      `${base}/crm/people?limit=${PAGE_SIZE}&offset=0&fields=${fields}`,
      { headers: { Authorization: auth } }
    );
    const firstData = await firstRes.json();
    const total = firstData.metadata?.total || 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    let people = firstData.items || [];

    // Fetch remaining pages — offset is page index, not record skip
    for (let page = 1; page < totalPages; page++) {
      const pageRes = await fetch(
        `${base}/crm/people?limit=${PAGE_SIZE}&offset=${page}&fields=${fields}`,
        { headers: { Authorization: auth } }
      );
      const pageItems = (await pageRes.json()).items || [];
      people = people.concat(pageItems);
    }

    // Deduplicate by Uid
    const seenUids = new Set();
    const uniquePeople = [];
    people.forEach(function(p) {
      if (!p || !p.Uid) return;
      if (seenUids.has(p.Uid)) return;
      seenUids.add(p.Uid);
      uniquePeople.push(p);
    });

    // ── Helpers ──────────────────────────────────────────────────────────────

    function isActive(p) {
      const account = (p.PersonAccount && p.PersonAccount[0] && p.PersonAccount[0].Account) || {};
      const label = String(account.AccountStageLabel || '').toLowerCase().trim();
      const ms = String(p.MembershipStatus || '').toLowerCase().trim();
      return label === 'active' || label === 'trialing' || ms === 'active' || ms === 'trialing';
    }

    // DirectoryRole is a custom Outseta field set to "Mentor" via the profile embed
    function isMentor(p) {
      return String(p.DirectoryRole || '').trim() === 'Mentor';
    }

    // DirectoryCategories returns as a JSON string; may also use semicolons
    function parseCategories(raw) {
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.flatMap(function(s) {
            return String(s).split(';').map(function(v) { return v.trim(); }).filter(Boolean);
          });
        }
        return String(parsed).split(';').map(function(v) { return v.trim(); }).filter(Boolean);
      } catch(e) {
        return String(raw).split(';').map(function(v) { return v.trim(); }).filter(Boolean);
      }
    }

    // ── Count ────────────────────────────────────────────────────────────────

    let memberCount = 0;
    let mentorCount = 0;
    const industrySet = new Set();

    uniquePeople.forEach(function(p) {
      if (!isActive(p)) return;

      memberCount++;

      if (isMentor(p)) mentorCount++;

      parseCategories(p.DirectoryCategories).forEach(function(cat) {
        if (cat) industrySet.add(cat);
      });
    });

    const payload = {
      members: memberCount,
      mentors: mentorCount,
      industries: industrySet.size
    };

    cachedData = payload;
    cacheTimestamp = Date.now();
    res.status(200).json(payload);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
