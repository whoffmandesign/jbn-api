// ─────────────────────────────────────────────────────────────────────────────
// JBN API — /api/directory.js
// Fetches all members from Outseta CRM and returns a merged, cleaned array.
// Includes in-memory caching (5 min TTL) and paginated fetching to support
// any member count without silent truncation.
// ─────────────────────────────────────────────────────────────────────────────

// In-memory cache — persists across warm Vercel function invocations
let cachedData = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.jbnphilly.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // Return cached response if still fresh — avoids hitting Outseta on every load
  if (cachedData && (Date.now() - cacheTimestamp < CACHE_TTL)) {
    return res.status(200).json(cachedData);
  }

  const auth = 'Outseta ' + process.env.OUTSETA_API_KEY + ':' + process.env.OUTSETA_API_SECRET;
  const base = 'https://jbnphilly.outseta.com/api/v1';
  const fields = 'Uid,FirstName,LastName,Title,Email,ProfileImageS3Url,Tags,PersonAccount,PersonAccount.Account.*,Bio,CompanyName,City,State,Country,DirectoryCategories,LinkedInUrl,Website,PhoneNumber,PublicDirectoryListing,MembershipStatus,AvailabilityStatus';

  try {
    // Outseta enforces a 25-record page size regardless of the limit param.
    // Use "fetch until short page" pagination — no dependency on metadata.total.
    const PAGE_SIZE = 25;
    let people = [];
    let offset = 0;

    while (true) {
      const url = `${base}/crm/people?limit=${PAGE_SIZE}&offset=${offset}&fields=${fields}`;
      console.log(`[pagination] Fetching offset=${offset}: ${url}`);
      const pageRes = await fetch(url, { headers: { Authorization: auth } });
      const pageData = await pageRes.json();
      const pageItems = pageData.items || [];
      console.log(`[pagination] offset=${offset} → got ${pageItems.length} items (metadata.total=${pageData.metadata?.total ?? 'n/a'})`);
      people = people.concat(pageItems);
      // If we got fewer records than a full page, we've reached the last page
      if (pageItems.length < PAGE_SIZE) break;
      offset += pageItems.length;
    }
    console.log(`[pagination] Done — total people fetched: ${people.length}`);

    const merged = people.map(function (p) {
      const personAccount = p.PersonAccount && p.PersonAccount[0];
      const account = personAccount && personAccount.Account;

      // Base64 encode email so it isn't exposed in plain HTML/source
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
        LinkedInUrl: p.LinkedInUrl || null,
        Website: p.Website || null,
        PhoneNumber: p.PhoneNumber || null,
        PublicDirectoryListing: p.PublicDirectoryListing || null,
        MembershipStatus: p.MembershipStatus || null,
        AvailabilityStatus: p.AvailabilityStatus || null,

        // Used by the profile page email button
        EmailB64: emailB64,

        Account: account || null
      };
    });

    // Store result in cache before returning
    const payload = { items: merged };
    cachedData = payload;
    cacheTimestamp = Date.now();
    res.status(200).json(payload);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
