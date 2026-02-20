export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.jbnphilly.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const response = await fetch(
    'https://jbnphilly.outseta.com/api/v1/crm/people?fields=Uid,FirstName,LastName,Title,ProfileImageS3Url,Account,Tags&limit=200',
    {
      headers: {
        'Authorization': 'Outseta ' + process.env.OUTSETA_API_KEY + ':' + process.env.OUTSETA_API_SECRET
      }
    }
  );

  const data = await response.json();
  res.status(200).json(data);
}
