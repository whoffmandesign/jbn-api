export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.jbnphilly.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const auth = 'Outseta ' + process.env.OUTSETA_API_KEY + ':' + process.env.OUTSETA_API_SECRET;
  const base = 'https://jbnphilly.outseta.com/api/v1';

  try {
    const peopleRes = await fetch(
      `${base}/crm/people?limit=200&fields=Uid,FirstName,LastName,Title,ProfileImageS3Url,Tags,PersonAccount,PersonAccount.Account.*,Bio,CompanyName,City,State,Country,DirectoryCategories,LinkedInUrl,Website,PhoneNumber,PublicDirectoryListing,MembershipStatus`,
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
        Account: account || null
      };
    });

    res.status(200).json({ items: merged });

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
