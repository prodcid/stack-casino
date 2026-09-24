/* ============================================================================
   Stack telemetry relay - a Cloudflare Worker.

   The game POSTs already-encrypted log packets here. This Worker holds the
   GitHub token as a SECRET (never in the game, never in this file) and does
   exactly one thing with it: create a NEW file in the private telemetry repo.
   It can't read logs back, and a create can't overwrite an existing file.

   Setup (Cloudflare dashboard > Workers):
     1. Create a Worker, paste this file in, Deploy.
     2. Settings > Variables:
          REPO      = your-github-user/stack-telemetry     (plain text)
          GH_TOKEN  = the fine-grained token                (Secret / encrypted)
   The token only needs: that one repo, Contents: Read and write.
   ========================================================================== */
const CORS = {
  'Access-Control-Allow-Origin': '*',          // the launcher runs from a local file (Origin: null)
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const reply = (msg, status) => new Response(msg, { status, headers: CORS });
const B64 = /^[A-Za-z0-9+/=]+$/;

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (req.method !== 'POST') return reply('POST only', 405);
    const body = await req.text();
    if (body.length > 250000) return reply('too big', 413);
    let j;
    try { j = JSON.parse(body); } catch { return reply('bad json', 400); }
    // only well-formed encrypted packets get through - no plaintext, nothing else
    if (!j || j.v !== 1 || ![j.k, j.iv, j.d].every(x => typeof x === 'string' && B64.test(x))) return reply('bad packet', 400);
    const now = new Date();
    const path = `logs/${now.toISOString().slice(0, 10)}/${now.getTime()}-${crypto.randomUUID().slice(0, 8)}.json`;
    const packet = JSON.stringify({ v: 1, z: !!j.z, k: j.k, iv: j.iv, d: j.d });
    const r = await fetch(`https://api.github.com/repos/${env.REPO}/contents/${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${env.GH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'stack-telemetry-relay',
      },
      body: JSON.stringify({ message: 'log', content: btoa(packet) }),
    });
    return reply(r.ok ? 'ok' : 'store failed', r.ok ? 200 : 502);
  },
};
