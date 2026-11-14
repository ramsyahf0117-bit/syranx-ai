// Pencarian YouTube lewat API resmi + penjaga kata terlarang (3 hari, lalu permanen).
// Env Vercel: YT_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
const BAD = ['bokep','bokeb','porn','porno','pornhub','xnxx','xvideos','xxx','sex','seks','sexs','sexy18','ngentot','ngewe','ngentod','memek','kontol','pepek','titit','jembut','colmek','coli','hentai','jav','bugil','telanjang','toket','payudara','sange','telanjang','bispak','vcs','bokepindo','tantegirang','semi18','film18','video18','dewasa18','nsfw','erotic','erotis','nude','naked','lesbi18','gangbang','threesome','blowjob','handjob','masturbasi','onani','bdsm','fetish','cum','creampie','milf','hijabsex','jilbabbokep'];
const PHRASES = ['18+','video dewasa','film dewasa','video panas','film semi','video syur','open bo','tante girang','abg telanjang','video mesum','bokep indo','adult video','adult film','sex video','adult content'];
function norm(s) { return String(s).toLowerCase().replace(/0/g,'o').replace(/1/g,'i').replace(/3/g,'e').replace(/4/g,'a').replace(/5/g,'s').replace(/7/g,'t').replace(/@/g,'a').replace(/\$/g,'s'); }
function isBad(q) {
  const n = norm(q);
  const low = String(q).toLowerCase();
  if (PHRASES.some(p => n.includes(p) || low.includes(p))) return true;
  const toks = n.split(/[^a-z]+/).filter(Boolean);
  if (toks.some(t => BAD.includes(t))) return true;
  const squashed = n.replace(/[^a-z]/g, '');
  return ['bokep','pornhub','xvideos','ngentot','hentai','bugil'].some(w => squashed.includes(w));
}
async function rpc(base, anon, auth, fn) {
  const r = await fetch(base.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: anon, Authorization: auth, 'Content-Type': 'application/json' }, body: '{}' });
  if (!r.ok) throw new Error('rpc_' + fn + '_' + r.status);
  return r.json();
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const key = process.env.YT_API_KEY, base = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY;
  if (!key) return res.status(503).json({ error: 'no_key' });
  if (!base || !anon) return res.status(503).json({ error: 'no_auth_config' });
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ') || auth.length < 40) return res.status(401).json({ error: 'login' });
  try {
    const u = await fetch(base.replace(/\/$/, '') + '/auth/v1/user', { headers: { Authorization: auth, apikey: anon } });
    if (!u.ok) return res.status(401).json({ error: 'login' });
  } catch (e) { return res.status(502).json({ error: 'auth_check' }); }
  const q = String((req.query && req.query.q) || '').trim().slice(0, 100);
  if (!q) return res.status(400).json({ error: 'no_query' });
  try {
    const st = await rpc(base, anon, auth, 'search_status');
    if (st && st.blocked) return res.status(403).json({ error: 'blocked', permanent: !!st.permanent, until: st.until });
    if (isBad(q)) { const v = await rpc(base, anon, auth, 'search_violation'); return res.status(403).json({ error: 'violation', permanent: !!v.permanent, until: v.until }); }
  } catch (e) { return res.status(502).json({ error: 'guard_unavailable' }); }
  const p = new URLSearchParams({ part: 'snippet', type: 'video', maxResults: '15', q, safeSearch: 'strict', videoEmbeddable: 'true', key });
  if (req.query && req.query.music === '1') p.set('videoCategoryId', '10');
  try {
    const r = await fetch('https://www.googleapis.com/youtube/v3/search?' + p.toString());
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: (j.error && j.error.message) || 'yt_error' });
    const items = (j.items || []).filter(x => x.id && x.id.videoId).map(x => ({ id: x.id.videoId, title: x.snippet.title, channel: x.snippet.channelTitle, thumb: ((x.snippet.thumbnails || {}).medium || (x.snippet.thumbnails || {}).default || {}).url || '' }));
    res.status(200).json({ items });
  } catch (e) { res.status(502).json({ error: 'yt_fetch' }); }
};
