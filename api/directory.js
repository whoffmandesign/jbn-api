export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.jbnphilly.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const auth = 'Outseta ' + process.env.OUTSETA_API_KEY + ':' + process.env.OUTSETA_API_SECRET;
  const base = 'https://jbnphilly.outseta.com/api/v1';

  try {
    // Fetch people
    const peopleRes = await fetch(
      `${base}/crm/people?limit=200&fields=Uid,FirstName,LastName,Title,ProfileImageS3Url,Tags,PersonAccount,PersonAccount.Account.*`,
      { headers: { Authorization: auth } }
    );
    const peopleData = await peopleRes.json();
    const people = peopleData.items || [];

    const merged = people.map(function(p) {
      const personAccount = p.PersonAccount && p.PersonAccount[0];
      const account = personAccount && personAccount.Account;
      return {
        Uid: p.Uid,
        FirstName: p.FirstName,
        LastName: p.LastName,
        Title: p.Title,
        ProfileImageS3Url: p.ProfileImageS3Url,
        Tags: p.Tags || [],
        Account: account || null
      };
    });

    res.status(200).json({ items: merged });

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
