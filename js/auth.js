/* ============================================================
   KREW — Auth Layer
   ============================================================ */
import { supabase } from './db.js';
import { getProfile } from './db.js';
import { showToast } from './nav.js';

// Cached session/profile
let _session = null;
let _profile = null;
const _listeners = [];

/* ========================
   SESSION MANAGEMENT
   ======================== */
export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  _session = session;
  if (session?.user) {
    try { _profile = await getProfile(session.user.id); } catch (_) { _profile = null; }
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    _session = session;
    if (session?.user) {
      try { _profile = await getProfile(session.user.id); } catch (_) { _profile = null; }
    } else {
      _profile = null;
    }
    _listeners.forEach(fn => fn(session, _profile));
  });

  return { session, profile: _profile };
}

export function onAuthChange(fn) {
  _listeners.push(fn);
  // Fire immediately with current state
  fn(_session, _profile);
}

export function getSession() { return _session; }
export function getUser()    { return _session?.user ?? null; }
export function getProfileCache() { return _profile; }
export function isLoggedIn() { return !!_session; }

export function requireAuth(redirectTo = '/login') {
  if (!isLoggedIn()) {
    window.location.href = `${redirectTo}?redirect=${encodeURIComponent(window.location.href)}`;
    return false;
  }
  return true;
}

/* ========================
   SIGN UP
   ======================== */
export async function signUp({ email, password, username, fullName }) {
  // Check username availability
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username.toLowerCase())
    .single();

  if (existing) throw new Error('Username already taken');

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username.toLowerCase(),
        full_name: fullName,
      },
    },
  });

  if (error) throw error;
  return data;
}

/* ========================
   SIGN IN
   ======================== */
export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/* ========================
   MAGIC LINK
   ======================== */
export async function sendMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/explore`,
    },
  });
  if (error) throw error;
}

/* ========================
   SIGN OUT
   ======================== */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  window.location.href = '/';
}

/* ========================
   PASSWORD RESET
   ======================== */
export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login?mode=reset`,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
