import { maybeShowLoginReward } from './login-reward.js';
import { setActiveDeck, markDeckRewardSeen, resetActiveDeck } from './data.js';

const AUTH_SESSION_KEY = 'meowtarot_auth_session';
const AUTH_CONFIG_ERROR = 'Supabase auth is not configured';

let supabaseClientPromise = null;
let authState = {
  user: null,
  ready: false,
};
const authListeners = new Set();

function readSupabaseConfig() {
  const scoped = window.__MEOWTAROT_SUPABASE__ || {};
  const url = scoped.url || window.MEOWTAROT_SUPABASE_URL || '';
  const anonKey = scoped.anonKey || window.MEOWTAROT_SUPABASE_ANON_KEY || '';
  return {
    url: String(url || '').trim(),
    anonKey: String(anonKey || '').trim(),
  };
}

export function isAuthConfigured() {
  const { url, anonKey } = readSupabaseConfig();
  return Boolean(url && anonKey);
}

async function createClient() {
  if (!isAuthConfigured()) return null;
  const { createClient } = await import('./vendor/supabase.js');
  const { url, anonKey } = readSupabaseConfig();
  const client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: AUTH_SESSION_KEY,
    },
  });

  client.auth.onAuthStateChange((_event, session) => {
    authState = {
      ...authState,
      user: session?.user || null,
      ready: true,
    };
    authListeners.forEach((listener) => {
      try {
        listener(authState.user);
      } catch (_) {
        // ignore listener error
      }
    });
    if (_event === 'SIGNED_OUT') {
      resetActiveDeck();
    }
    maybeShowLoginReward(session?.user, window.location.pathname.startsWith('/th/') ? 'th' : 'en');
    try {
      const pendingClaim = localStorage.getItem('meowtarot_pending_deck_claim');
      if (pendingClaim && session?.user) {
        setActiveDeck(pendingClaim);
        markDeckRewardSeen(pendingClaim);
        localStorage.removeItem('meowtarot_pending_deck_claim');
      }
    } catch (_) {
      // ignore claim resume errors
    }
  });

  const { data } = await client.auth.getUser();
  authState = {
    user: data?.user || null,
    ready: true,
  };
  return client;
}

export async function getSupabaseClient() {
  if (!supabaseClientPromise) {
    supabaseClientPromise = createClient().catch((error) => {
      console.warn('Failed to init Supabase client', error);
      supabaseClientPromise = null;
      return null;
    });
  }
  return supabaseClientPromise;
}

export async function getCurrentUser() {
  const client = await getSupabaseClient();
  if (!client) return null;
  if (authState.ready) return authState.user;
  const { data } = await client.auth.getUser();
  authState = {
    user: data?.user || null,
    ready: true,
  };
  return authState.user;
}

export function getCurrentUserSync() {
  return authState.user ?? null;
}

// Embedded / in-app webviews (LINE, Facebook, Instagram, Messenger, TikTok, Android
// System WebView, …) where Google rejects OAuth with `disallowed_useragent` (403).
// There's no way to complete Google sign-in inside these — the user must open the page
// in a real browser. Callers should detect this and guide the user instead of firing
// a doomed OAuth redirect.
export function isInAppBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /\b(Line|FBAN|FBAV|FB_IAB|Instagram|Messenger|MicroMessenger|TikTok|Snapchat|Pinterest|GSA)\b/i.test(ua)
    || /; wv\)/.test(ua); // Android System WebView
}

export async function loginWithProvider(provider = 'google') {
  if (isInAppBrowser()) {
    const err = new Error('Google sign-in is blocked inside in-app browsers — open in Safari/Chrome.');
    err.code = 'IN_APP_BROWSER';
    throw err;
  }
  const client = await getSupabaseClient();
  if (!client) throw new Error(AUTH_CONFIG_ERROR);
  const safeProvider = provider === 'apple' ? 'apple' : 'google';
  const redirectTo = window.location.href;
  const { error } = await client.auth.signInWithOAuth({
    provider: safeProvider,
    options: { redirectTo },
  });
  if (error) throw error;
}

export async function logout() {
  const client = await getSupabaseClient();
  if (!client) return;
  await client.auth.signOut();
  const USER_STATE_KEYS = [
    'meowtarot_user_progress',
    'meowtarot_active_deck',
    'meowtarot_deck_rewards_seen',
    'meowtarot_login_reward_seen',
    'meowtarot.daily.cardOfTheDay',
    'meowtarot_share_payload',
    'meowtarot_persisted_reading_session_keys',
    'meowtarot_profile_revisit',
    'meowtarot_session_id',
    '_mt_profile_last_visit',
    'meowtarot_selection',
  ];
  USER_STATE_KEYS.forEach((k) => localStorage.removeItem(k));
}

export function subscribeAuthState(listener) {
  if (typeof listener !== 'function') return () => {};
  authListeners.add(listener);
  if (authState.ready) {
    listener(authState.user);
  }
  return () => authListeners.delete(listener);
}
