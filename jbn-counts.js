export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://www.jbnphilly.com");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const OUTSETA_DOMAIN = process.env.OUTSETA_DOMAIN; // e.g. jbnphilly.outseta.com
  const KEY = process.env.OUTSETA_API_KEY;
  const SECRET = process.env.OUTSETA_API_SECRET;

  const url = `https://${OUTSETA_DOMAIN}/api/v1/crm/people?limit=1&offset=0`;

  const response = await fetch(url, {
    headers: { Authorization: `Outseta ${KEY}:${SECRET}` }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return res.status(500).json({ error: "Outseta failed", status: response.status, detail: text });
  }

  const json = await response.json();
  const members = json?.metadata?.total ?? 0;

  return res.status(200).json({ members });
}
