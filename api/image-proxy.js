export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  try {
    const decodedUrl = decodeURIComponent(url);
    const allowedDomains = ['image.pollinations.ai', 'images.unsplash.com'];
    const urlObj = new URL(decodedUrl);
    if (!allowedDomains.some((d) => urlObj.hostname.includes(d))) {
      return res.status(403).json({ error: 'Domain not allowed' });
    }
    const response = await fetch(decodedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!response.ok) return res.status(response.status).json({ error: 'Image fetch failed' });
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(Buffer.from(buffer));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
