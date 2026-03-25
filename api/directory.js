// ─────────────────────────────────────────────────────────────────────────────
// JBN API — /api/directory.js
// Fetches all members from Outseta CRM and returns a merged, cleaned array.
// Includes in-memory caching (5 min TTL) and paginated fetching to support
// any member count without silent truncation.
//
// ⚠️ OUTSETA PAGINATION QUIRK:
//   offset = PAGE INDEX (0, 1, 2…) — NOT a record skip value.
//   Use metadata.total to calculate total pages and loop accordingly.
//   DO NOT use /crm/accounts — that endpoint returns person fields as null.
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
  const fields = 'Uid,FirstName,LastName,Title,Email,ProfileImageS3Url,Tags,PersonAccount,PersonAccount.Account.*,Bio,CompanyName,City,State,Country,DirectoryCategories,DirectoryRole,LinkedInUrl,Website,PhoneNumber,PublicDirectoryListing,MembershipStatus,AvailabilityStatus';

  try {
    // Fetch first page + read total count from metadata
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

    // Deduplicate by Uid — safety net against any repeated pages
    const uniquePeople = [];
    const seenUids = new Set();
    people.forEach(function(p) {
      if (!p || !p.Uid) return;
      if (seenUids.has(p.Uid)) return;
      seenUids.add(p.Uid);
      uniquePeople.push(p);
    });

    const merged = uniquePeople.map(function(p) {
      const personAccount = p.PersonAccount && p.PersonAccount[0];
      const account = personAccount && personAccount.Account;

      // Base64-encode email to avoid exposing it in frontend HTML
      const emailB64 = p.Email
        ? Buffer.from(String(p.Email), 'utf8').toString('base64')
        : null;

      return {
        Uid: p.Uid,
        FirstName: p.FirstName,
        LastName: p.LastName,
        Title: p.Title,
        ProfileImageS3Url: p.ProfileImageS3Url,
        Tags: p.Tags || [],
        Bio: p.Bio || null,
        CompanyName: p.CompanyName || null,
        City: p.City || null,
        State: p.State || null,
        Country: p.Country || null,
        DirectoryCategories: p.DirectoryCategories || null,
        // DirectoryRole drives mentor detection in the frontend (Plan UID is unreliable)
        DirectoryRole: p.DirectoryRole || null,
        LinkedInUrl: p.LinkedInUrl || null,
        Website: p.Website || null,
        PhoneNumber: p.PhoneNumber || null,
        // Preserve false values — don't coerce with || null
        PublicDirectoryListing: p.PublicDirectoryListing !== undefined ? p.PublicDirectoryListing : null,
        MembershipStatus: p.MembershipStatus || null,
        AvailabilityStatus: p.AvailabilityStatus || null,
        EmailB64: emailB64,
        Account: account || null
      };
    });

    const payload = { items: merged };
    cachedData = payload;
    cacheTimestamp = Date.now();
    res.status(200).json(payload);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
