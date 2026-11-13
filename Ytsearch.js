// Pencarian YouTube lewat API resmi. Kunci API disimpan di Vercel (env YT_API_KEY), tidak ada di browser.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
  const key = process.env.YT_API_KEY;
  if (!key) return res.status(503).json({ error: 'no_key' });
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ') || auth.length < 40) return res.status(401).json({ error: 'login' });
  // verifikasi login (opsional, aktif jika SUPABASE_URL dan SUPABASE_ANON_KEY ada di env Vercel)
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    try {
      const u = await fetch(process.env.SUPABASE_URL.replace(/\/$/, '') + '/auth/v1/user', { headers: { Authorization: auth, apikey: process.env.SUPABASE_ANON_KEY } });
      if (!u.ok) return res.status(401).json({ error: 'login' });
    } catch (e) { return res.status(502).json({ error: 'auth_check' }); }
  }
  const q = String((req.query && req.query.q) || '').trim().slice(0, 100);
  if (!q) return res.status(400).json({ error: 'no_query' });
  const p = new URLSearchParams({ part: 'snippet', type: 'video', maxResults: '15', q, safeSearch: 'moderate', videoEmbeddable: 'true', key });
  if (req.query && req.query.music === '1') p.set('videoCategoryId', '10');
  try {
    const r = await fetch('https://www.googleapis.com/youtube/v3/search?' + p.toString());
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: (j.error && j.error.message) || 'yt_error' });
    const items = (j.items || []).filter(x => x.id && x.id.videoId).map(x => ({ id: x.id.videoId, title: x.snippet.title, channel: x.snippet.channelTitle, thumb: ((x.snippet.thumbnails || {}).medium || (x.snippet.thumbnails || {}).default || {}).url || '' }));
    res.status(200).json({ items });
  } catch (e) { res.status(502).json({ error: 'yt_fetch' }); }
};
