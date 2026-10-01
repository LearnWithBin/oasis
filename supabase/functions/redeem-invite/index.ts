import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Sign in first.' }, 401);
  const url = Deno.env.get('SUPABASE_URL')!;
  const publishable = Deno.env.get('SUPABASE_ANON_KEY')!;
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const userClient = createClient(url, publishable, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: 'Sign in first.' }, 401);
  let invite: string;
  try { invite = (await req.json()).invite; } catch { return json({ error: 'Missing link.' }, 400); }
  if (typeof invite !== 'string' || !/^[a-f0-9]{48}$/.test(invite)) return json({ error: 'This link is invalid.' }, 400);
  const hashBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(invite)));
  const hash = [...hashBytes].map(b => b.toString(16).padStart(2, '0')).join('');
  const admin = createClient(url, secret);
  const { data: oasis, error } = await admin.from('oases').select('id').eq('invite_hash', hash).single();
  if (error || !oasis) return json({ error: 'This personal link was not found.' }, 404);
  const { error: claimError } = await admin.from('oases').update({ owner_auth_uid: user.id }).eq('id', oasis.id);
  if (claimError) return json({ error: 'Could not open this Oasis.' }, 409);
  return json({ ok: true });
});
