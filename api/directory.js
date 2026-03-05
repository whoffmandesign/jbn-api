export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.jbnphilly.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const auth = 'Outseta ' + process.env.OUTSETA_API_KEY + ':' + process.env.OUTSETA_API_SECRET;
  const base = 'https://jbnphilly.outseta.com/api/v1';

  try {
    const peopleRes = await fetch(
      // ✅ Added Email so we can encode it server-side
      `${base}/crm/people?limit=200&fields=Uid,FirstName,LastName,Title,Email,ProfileImageS3Url,Tags,PersonAccount,PersonAccount.Account.*,Bio,CompanyName,City,State,Country,DirectoryCategories,LinkedInUrl,Website,PhoneNumber,PublicDirectoryListing,MembershipStatus,AvailabilityStatus,Education,Specialization,OtherOrganizations,AdditionalPairingInfo`,
      { headers: { Authorization: auth } }
    );

    const peopleData = await peopleRes.json();
    const people = peopleData.items || [];

    const merged = people.map(function (p) {
      const personAccount = p.PersonAccount && p.PersonAccount[0];
      const account = personAccount && personAccount.Account;

      // ✅ Base64 encode email so it isn't visible in HTML/source
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
        Education: p.Education || null,
        Specialization: p.Specialization || null,
        OtherOrganizations: p.OtherOrganizations || null,
        AdditionalPairingInfo: p.AdditionalPairingInfo || null,

        // ✅ Mentor flag: plan UID (signup flow) OR mentor availability status (imported)
        IsMentor: (function() {
          var planUid = account && account.CurrentSubscription && account.CurrentSubscription.Plan && account.CurrentSubscription.Plan.Uid;
          if (planUid === '1Qpekp9E') return true;
          var av = p.AvailabilityStatus;
          var statuses = Array.isArray(av) ? av : (av ? [av] : []);
          var mentorStatuses = ['open to mentoring','accepting new mentees','by referral only','not currently mentoring'];
          return statuses.some(function(s) { return mentorStatuses.indexOf(String(s).toLowerCase().trim()) !== -1; });
        })(),

        // ✅ New field used by the profile page button
        EmailB64: emailB64,

        Account: account || null
      };
    });

    res.status(200).json({ items: merged });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
