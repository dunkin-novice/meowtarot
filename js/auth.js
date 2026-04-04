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
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
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

export async function loginWithProvider(provider = 'google') {
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
}

export function subscribeAuthState(listener) {
  if (typeof listener !== 'function') return () => {};
  authListeners.add(listener);
  if (authState.ready) {
    listener(authState.user);
  }
  return () => authListeners.delete(listener);
}
