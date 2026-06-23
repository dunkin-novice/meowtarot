import { maybeShowLoginReward } from './login-reward.js';
import { setActiveDeck, markDeckRewardSeen, resetActiveDeck } from './data.js';
import { trackSigninStarted, trackSigninBlocked, trackSigninSucceeded, trackAccountDeleted } from './analytics.js';

function authLocale() {
  try { return window.location.pathname.startsWith('/th/') ? 'th' : 'en'; } catch (_) { return 'en'; }
}

const AUTH_SESSION_KEY = 'meowtarot_auth_session';
const AUTH_CONFIG_ERROR = 'Supabase auth is not configured';

let supabaseClientPromise = null;
let authState = {
  user: null,
  ready: false,
};
const authListeners = new Set();

// Public Supabase project config. Safe to ship in client JS — the anon key is RLS-gated
// and is ALREADY inlined in profile.html / reading.html. Hardcoded as a fallback so EVERY
// page can start auth, not only the few that include an inline window.__MEOWTAROT_SUPABASE__
// script: the daily/home/decks sign-in gates were silently failing (no client) without it.
const SUPABASE_URL_FALLBACK = 'https://dzgjjvuiliickdgzshjr.supabase.co';
const SUPABASE_ANON_KEY_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6Z2pqdnVpbGlpY2tkZ3pzaGpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTUyMjMsImV4cCI6MjA5MjI3MTIyM30.dZMHmPe_BdLoDGbwUqLByFx9WYAzP1aCrIw3f2XjSNk';

function readSupabaseConfig() {
  const scoped = window.__MEOWTAROT_SUPABASE__ || {};
  const url = scoped.url || window.MEOWTAROT_SUPABASE_URL || SUPABASE_URL_FALLBACK;
  const anonKey = scoped.anonKey || window.MEOWTAROT_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_FALLBACK;
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
    const prevUser = authState.user;
    authState = {
      ...authState,
      user: session?.user || null,
      ready: true,
    };
    // A genuine new sign-in (not a session restore — those emit INITIAL_SESSION — and
    // not a token refresh while already logged in). Analytics fires only here.
    if (_event === 'SIGNED_IN' && !prevUser && session?.user) {
      try {
        trackSigninSucceeded({
          locale: authLocale(),
          userId: session.user.id || 'anon',
          provider: session.user.app_metadata?.provider,
        });
      } catch (_) {}
    }
    // Flush any readings drawn while logged out so the history isn't lost (#5/#4).
    // Must run on BOTH a fresh SIGNED_IN and a session restore (INITIAL_SESSION) —
    // opening the app already-logged-in emits INITIAL_SESSION, not SIGNED_IN, so
    // flushing only on SIGNED_IN would strand a queued reading until the next fresh
    // login. flushPendingReadings is idempotent (clears the queue first, daily-dedups),
    // so calling it on session restore is safe. Dynamic import avoids a static cycle.
    if (session?.user && (_event === 'SIGNED_IN' || _event === 'INITIAL_SESSION')) {
      import('./reading-history.js')
        .then(({ flushPendingReadings }) => flushPendingReadings(session.user.id))
        .catch(() => {});
    }
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
    maybeShowLoginReward(session?.user, window.location.pathname.startsWith('/th/') ? 'th' : 'en', {
      fresh: _event === 'SIGNED_IN' && !prevUser, // true only on a genuine new sign-in (not a page-load session restore)
    });
    // Surface a popup for any newly-available deck (gift / achievement) the user
    // hasn't acknowledged. Dynamic import avoids a static auth<->deck-reward cycle;
    // the helper self-guards against stacking on the login-reward popup above.
    if (session?.user) {
      const lang = window.location.pathname.startsWith('/th/') ? 'th' : 'en';
      import('./deck-reward.js')
        .then(({ maybeShowUnseenDeckRewards }) => maybeShowUnseenDeckRewards(lang))
        .catch(() => {});
    }
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

// On iOS/Android the app runs inside a Capacitor WKWebView; `window.Capacitor`
// is injected by the native bridge (undefined on the plain web). Native sign-in
// must NOT use the embedded-webview OAuth redirect (Google blocks it) — it opens the
// system browser instead (for both Google and Apple).
export function isNativePlatform() {
  try {
    return window?.Capacitor?.isNativePlatform?.() === true;
  } catch (_) {
    return false;
  }
}

// Custom URL scheme the OAuth redirect returns on. MUST match the iOS Info.plist
// CFBundleURLTypes entry AND the Supabase Auth "Redirect URLs" allowlist.
const NATIVE_AUTH_REDIRECT = 'com.meowtarot.app://auth-callback';

// Supabase may hand the redirect back as ?code=… (PKCE) or #access_token=…&refresh_token=… (implicit).
function parseAuthRedirect(url) {
  const out = { code: null, accessToken: null, refreshToken: null };
  const qIndex = url.indexOf('?');
  const hIndex = url.indexOf('#');
  if (qIndex !== -1) {
    const q = new URLSearchParams(url.slice(qIndex + 1, hIndex === -1 ? undefined : hIndex));
    out.code = q.get('code');
  }
  if (hIndex !== -1) {
    const h = new URLSearchParams(url.slice(hIndex + 1));
    out.accessToken = h.get('access_token');
    out.refreshToken = h.get('refresh_token');
    if (!out.code) out.code = h.get('code');
  }
  return out;
}

// Native sign-in (Google AND Apple): open the provider's consent page in the SYSTEM
// browser (SFSafariViewController) — which both providers permit, unlike the embedded
// webview — then catch the deep-link redirect back into the app and hand the result to
// Supabase. We use the browser OAuth flow for Apple too (rather than a native
// Sign-in-with-Apple plugin) because @capacitor-community/apple-sign-in is pinned to
// Capacitor 7 and won't resolve on Capacitor 8. Still satisfies App Store 4.8.
async function loginViaSystemBrowser(client, provider) {
  const { Browser } = await import('./vendor/browser.js');
  const { App } = await import('./vendor/app.js');

  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error(`Could not start ${provider} sign-in`);

  await new Promise((resolve, reject) => {
    let settled = false;
    let urlSub = null;
    let finishSub = null;
    const cleanup = () => {
      try { urlSub?.remove?.(); } catch (_) {}
      try { finishSub?.remove?.(); } catch (_) {}
    };

    App.addListener('appUrlOpen', async ({ url }) => {
      if (settled || !url || !url.startsWith(NATIVE_AUTH_REDIRECT)) return;
      settled = true;
      try {
        const { code, accessToken, refreshToken } = parseAuthRedirect(url);
        if (code) {
          const { error: exErr } = await client.auth.exchangeCodeForSession(code);
          if (exErr) throw exErr;
        } else if (accessToken && refreshToken) {
          const { error: sErr } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (sErr) throw sErr;
        } else {
          throw new Error('Sign-in did not return a session');
        }
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        cleanup();
        Browser.close().catch(() => {});
      }
    }).then((s) => { urlSub = s; });

    // User dismissed the system browser without finishing → don't hang forever.
    Browser.addListener('browserFinished', () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(Object.assign(new Error('Sign-in cancelled'), { code: 'CANCELLED' }));
    }).then((s) => { finishSub = s; });

    Browser.open({ url: data.url }).catch((e) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(e);
    });
  });
}

export async function loginWithProvider(provider = 'google') {
  const safeProvider = provider === 'apple' ? 'apple' : 'google';
  try { trackSigninStarted({ provider: safeProvider, locale: authLocale(), surface: isNativePlatform() ? 'native' : 'web' }); } catch (_) {}

  // Native app: both providers via the system browser, never the blocked webview redirect.
  if (isNativePlatform()) {
    const client = await getSupabaseClient();
    if (!client) throw new Error(AUTH_CONFIG_ERROR);
    return loginViaSystemBrowser(client, safeProvider);
  }

  // Plain web: in-app webviews (LINE/FB/…) can't complete Google OAuth — guide the user out.
  if (isInAppBrowser()) {
    try { trackSigninBlocked({ reason: 'in_app_browser', locale: authLocale() }); } catch (_) {}
    const err = new Error('Google sign-in is blocked inside in-app browsers — open in Safari/Chrome.');
    err.code = 'IN_APP_BROWSER';
    throw err;
  }
  const client = await getSupabaseClient();
  if (!client) throw new Error(AUTH_CONFIG_ERROR);
  // Return to a CLEAN, stable URL (profile.html) rather than window.location.href — the full href
  // carries volatile query/hash that often fails Supabase's Redirect-URL allow-list → Supabase
  // falls back to Site URL and the session never lands. BUT we remember where the user was first,
  // so common.js can bounce them BACK there once signed in — so they stay on (e.g.) the reading
  // result instead of getting stranded on Profile. (founder 2026-06-23)
  try { localStorage.setItem('mt_signin_return', window.location.href); } catch (_) {}
  // Mark this as a fresh sign-in so common.js can, on return, tell the user "you've already
  // received today's quota" if they earned the daily coin before signing in. (founder 2026-06-23)
  try { sessionStorage.setItem('mt_postsignin_quota', '1'); } catch (_) {}
  const redirectTo = `${window.location.origin}${authLocale() === 'th' ? '/th' : ''}/profile.html`;
  const { error } = await client.auth.signInWithOAuth({
    provider: safeProvider,
    options: { redirectTo },
  });
  if (error) throw error;
}

// Permanently delete the signed-in user's account + all synced data via the
// `delete-account` Edge Function (runs with the service-role key), then clear the
// local session. Required by App Store Guideline 5.1.1(v). Irreversible.
export async function deleteAccount() {
  const client = await getSupabaseClient();
  if (!client) throw new Error(AUTH_CONFIG_ERROR);
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error('Not signed in');

  const { error } = await client.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;

  try { trackAccountDeleted({ locale: authLocale() }); } catch (_) {}
  await logout();
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
