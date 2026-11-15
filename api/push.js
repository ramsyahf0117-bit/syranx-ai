// Kirim push notifikasi pesan baru. Env Vercel: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
const webpush = require('web-push');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const last = new Map();
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const base = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), anon = process.env.SUPABASE_ANON_KEY, svc = process.env.SUPABASE_SERVICE_KEY, pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!base || !anon || !svc || !pub || !priv) return res.status(503).json({ error: 'no_config' });
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ') || auth.length < 40) return res.status(401).json({ error: 'login' });
  let uid;
  try { const u = await fetch(base + '/auth/v1/user', { headers: { Authorization: auth, apikey: anon } }); if (!u.ok) return res.status(401).json({ error: 'login' }); uid = (await u.json()).id; } catch (e) { return res.status(502).json({ error: 'auth_check' }); }
  const to = String((req.body && req.body.to) || ''); if (!UUID.test(to) || !uid || to === uid) return res.status(400).json({ error: 'bad_to' });
  const k = uid + '>' + to, now = Date.now(); if (now - (last.get(k) || 0) < 4000) return res.status(200).json({ sent: 0 }); last.set(k, now); if (last.size > 500) last.clear();
  const H = { apikey: svc };
  try {
    const since = new Date(now - 60000).toISOString();
    const dm = await (await fetch(`${base}/rest/v1/direct_messages?select=id&sender_id=eq.${uid}&receiver_id=eq.${to}&created_at=gte.${encodeURIComponent(since)}&limit=1`, { headers: H })).json();
    if (!Array.isArray(dm) || !dm.length) return res.status(200).json({ sent: 0 });
    const pr = await (await fetch(`${base}/rest/v1/profiles?select=username&id=eq.${uid}`, { headers: H })).json();
    const name = (Array.isArray(pr) && pr[0] && pr[0].username) || 'Syranx';
    const subs = await (await fetch(`${base}/rest/v1/push_subs?select=endpoint,p256dh,auth_key&user_id=eq.${to}`, { headers: H })).json();
    if (!Array.isArray(subs) || !subs.length) return res.status(200).json({ sent: 0 });
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@syranx.app', pub, priv);
    let sent = 0;
    await Promise.all(subs.map(async s => {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, JSON.stringify({ title: name, body: 'Pesan baru', tag: 'dm-' + uid }), { TTL: 3600 }); sent++; }
      catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await fetch(`${base}/rest/v1/push_subs?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE', headers: H }).catch(() => {}); }
    }));
    res.status(200).json({ sent });
  } catch (e) { res.status(502).json({ error: 'push_fail' }); }
};
