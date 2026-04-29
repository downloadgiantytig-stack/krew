/* ============================================================
   KREW — Database Layer (Supabase helpers)
   ============================================================ */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Init Supabase client (UMD loaded via CDN)
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ========================
   PROFILES
   ======================== */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function getProfileByUsername(username) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* ========================
   SQUADS
   ======================== */
export async function getSquads({ limit = 20, offset = 0, status = null, search = null } = {}) {
  let q = supabase
    .from('squads')
    .select(`
      *,
      creator:profiles(id, username, full_name, avatar_url),
      squad_members(count)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) q = q.eq('status', status);
  if (search) q = q.ilike('name', `%${search}%`);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function getSquad(squadId) {
  const { data, error } = await supabase
    .from('squads')
    .select(`
      *,
      creator:profiles(id, username, full_name, avatar_url),
      squad_members(
        id, role, joined_at,
        user:profiles(id, username, full_name, avatar_url, skills)
      )
    `)
    .eq('id', squadId)
    .single();
  if (error) throw error;
  return data;
}

export async function createSquad(squadData) {
  const { data, error } = await supabase
    .from('squads')
    .insert(squadData)
    .select()
    .single();
  if (error) throw error;

  // Auto-add creator as owner member
  await supabase.from('squad_members').insert({
    squad_id: data.id,
    user_id: squadData.creator_id,
    role: 'owner',
  });

  return data;
}

export async function joinSquad(squadId, userId) {
  const { error } = await supabase
    .from('squad_members')
    .insert({ squad_id: squadId, user_id: userId, role: 'member' });
  if (error) throw error;
}

export async function leaveSquad(squadId, userId) {
  const { error } = await supabase
    .from('squad_members')
    .delete()
    .eq('squad_id', squadId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function isSquadMember(squadId, userId) {
  const { data } = await supabase
    .from('squad_members')
    .select('id')
    .eq('squad_id', squadId)
    .eq('user_id', userId)
    .single();
  return !!data;
}

export async function getUserSquads(userId) {
  const { data, error } = await supabase
    .from('squad_members')
    .select(`
      role,
      squad:squads(
        *,
        creator:profiles(id, username, avatar_url),
        squad_members(count)
      )
    `)
    .eq('user_id', userId)
    .order('joined_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(m => ({ ...m.squad, role: m.role }));
}

/* ========================
   PRODUCTS
   ======================== */
export async function getProducts({ limit = 20, offset = 0, category = null, search = null } = {}) {
  let q = supabase
    .from('products')
    .select(`
      *,
      creator:profiles(id, username, full_name, avatar_url)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) q = q.eq('category', category);
  if (search)   q = q.ilike('title', `%${search}%`);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function getProduct(productId) {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      creator:profiles(id, username, full_name, avatar_url, bio, github_url)
    `)
    .eq('id', productId)
    .single();
  if (error) throw error;
  return data;
}

export async function createProduct(productData) {
  const { data, error } = await supabase
    .from('products')
    .insert(productData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getUserProducts(userId) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('creator_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function incrementDownloads(productId) {
  await supabase.rpc('increment_downloads', { product_id: productId });
}

/* ========================
   POSTS
   ======================== */
export async function getPosts({ limit = 20, offset = 0, squadId = null } = {}) {
  let q = supabase
    .from('posts')
    .select(`
      *,
      author:profiles(id, username, full_name, avatar_url)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (squadId) q = q.eq('squad_id', squadId);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createPost(postData) {
  const { data, error } = await supabase
    .from('posts')
    .insert(postData)
    .select(`
      *,
      author:profiles(id, username, full_name, avatar_url)
    `)
    .single();
  if (error) throw error;
  return data;
}

/* ========================
   LIKES
   ======================== */
export async function getLikeCount(targetType, targetId) {
  const { count } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('target_type', targetType)
    .eq('target_id', targetId);
  return count || 0;
}

export async function hasLiked(userId, targetType, targetId) {
  const { data } = await supabase
    .from('likes')
    .select('id')
    .eq('user_id', userId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .single();
  return !!data;
}

export async function toggleLike(userId, targetType, targetId) {
  const liked = await hasLiked(userId, targetType, targetId);
  if (liked) {
    await supabase.from('likes').delete()
      .eq('user_id', userId)
      .eq('target_type', targetType)
      .eq('target_id', targetId);
    return false;
  } else {
    await supabase.from('likes').insert({ user_id: userId, target_type: targetType, target_id: targetId });
    return true;
  }
}

/* ========================
   EXPLORE FEED (mixed squads + products)
   ======================== */
export async function getExploreFeed({ limit = 30 } = {}) {
  const [squads, products] = await Promise.all([
    getSquads({ limit }),
    getProducts({ limit }),
  ]);

  // Interleave and sort by date
  const feed = [
    ...squads.map(s => ({ ...s, _type: 'squad' })),
    ...products.map(p => ({ ...p, _type: 'product' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return feed.slice(0, limit);
}

/* ========================
   STATS (for landing page counters)
   ======================== */
export async function getSiteStats() {
  const [{ count: squads }, { count: products }, { count: users }] = await Promise.all([
    supabase.from('squads').select('*', { count: 'exact', head: true }),
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
  ]);
  return { squads: squads || 0, products: products || 0, users: users || 0 };
}
