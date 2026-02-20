export default async function handler(req, res) {
  // CORS (Squarespace can send preflight OPTIONS)
  res.setHeader('Access-Control-Allow-Origin', 'https://www.jbnphilly.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const baseUrl = 'https://jbnphilly.outseta.com/api/v1/crm/people';

  // Keep fields tight, but note: fields alone won't expand related objects
  const fields = [
    'Uid',
    'FirstName',
    'LastName',
    'Title',
    'ProfileImageS3Url',
    'Account',
    'Tags'
  ].join(',');

  // Try expand first, then include as a fallback (different APIs use different names)
  const urlsToTry = [
    `${baseUrl}?limit=200&fields=${encodeURIComponent(fields)}&expand=Account,Tags`,
    `${baseUrl}?limit=200&fields=${encodeURIComponent(fields)}&include=Account,Tags`,
    `${baseUrl}?limit=200&fields=${encodeURIComponent(fields)}`
  ];

  const authHeader =
    'Outseta ' + process.env.OUTSETA_API_KEY + ':' + process.env.OUTSETA_API_SECRET;

  let lastStatus = 0;
  let lastBodyText = '';

  for (const url of urlsToTry) {
    const response = await fetch(url, {
      headers: { Authorization: authHeader }
    });

    lastStatus = response.status;
    lastBodyText = await response.text();

    // If OK, return JSON
    if (response.ok) {
      try {
        const data = JSON.parse(lastBodyText);
        res.status(200).json(data);
        return;
      } catch (e) {
        // If Outseta returned non-JSON unexpectedly
        res.status(502).json({
          error: 'Outseta returned invalid JSON',
          status: lastStatus,
          sample: lastBodyText.slice(0, 300)
        });
        return;
      }
    }
  }

  // If all attempts failed
  res.status(502).json({
    error: 'Failed to fetch from Outseta',
    status: lastStatus,
    sample: lastBodyText.slice(0, 500)
  });
}
