import { getCurrentUser, getSupabaseClient } from './auth.js';
import { getAnonymousUserId, getUserProgress, setUserProgress } from './progress.js';

function normalizeBooleanMap(input, defaults) {
  return Object.keys(defaults || {}).reduce((acc, key) => {
    acc[key] = Boolean(input?.[key]);
    return acc;
  }, {});
}

function mergeUniqueArray(a = [], b = []) {
  return [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])];
}

export function mergeProgress(localProgress = {}, remoteProgress = {}) {
  const localAchievements = localProgress?.achievements || {};
  const remoteAchievements = remoteProgress?.achievements || {};
  const achievementDefaults = {
    ...remoteAchievements,
    ...localAchievements,
  };

  const merged = {
    ...remoteProgress,
    ...localProgress,
    streak_current: Math.max(Number(localProgress?.streak_current) || 0, Number(remoteProgress?.streak_current) || 0),
    streak_best: Math.max(Number(localProgress?.streak_best) || 0, Number(remoteProgress?.streak_best) || 0),
    total_daily_reads: Math.max(Number(localProgress?.total_daily_reads) || 0, Number(remoteProgress?.total_daily_reads) || 0),
    created_at: Math.min(
      Number(localProgress?.created_at) || Number(remoteProgress?.created_at) || Date.now(),
      Number(remoteProgress?.created_at) || Number(localProgress?.created_at) || Date.now(),
    ),
    journey_started_at: Math.min(
      Number(localProgress?.journey_started_at) || Number(localProgress?.created_at) || Date.now(),
      Number(remoteProgress?.journey_started_at) || Number(remoteProgress?.created_at) || Date.now(),
    ),
    collected_base_cards: mergeUniqueArray(localProgress?.collected_base_cards, remoteProgress?.collected_base_cards),
    collected_oriented_cards: mergeUniqueArray(localProgress?.collected_oriented_cards, remoteProgress?.collected_oriented_cards),
  };

  merged.achievements = normalizeBooleanMap({
    ...normalizeBooleanMap(remoteAchievements, achievementDefaults),
    ...normalizeBooleanMap(localAchievements, achievementDefaults),
  }, achievementDefaults);

  const localDate = String(localProgress?.last_daily_read_date || '');
  const remoteDate = String(remoteProgress?.last_daily_read_date || '');
  merged.last_daily_read_date = localDate > remoteDate ? localDate : remoteDate;

  return merged;
}

async function upsertUserRow(client, user) {
  const provider = String(user?.app_metadata?.provider || user?.identities?.[0]?.provider || 'google').toLowerCase();
  const anonymousUserId = getAnonymousUserId();
  const payload = {
    id: user.id,
    provider: provider === 'apple' ? 'apple' : 'google',
    anonymous_link_id: anonymousUserId || null,
  };

  await client.from('users').upsert(payload, { onConflict: 'id' });
}

export async function loadCloudProgress(userId) {
  const client = await getSupabaseClient();
  if (!client || !userId) return null;

  const { data, error } = await client
    .from('user_progress')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.data || null;
}

export async function saveCloudProgress(userId, progress) {
  const client = await getSupabaseClient();
  if (!client || !userId || !progress) return false;

  const { error } = await client.from('user_progress').upsert({
    user_id: userId,
    data: progress,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (error) throw error;
  return true;
}

export async function migrateLocalToAccount(user) {
  const client = await getSupabaseClient();
  if (!client || !user?.id) return { ok: false, reason: 'not-configured' };

  const localProgress = getUserProgress();
  const remoteProgress = await loadCloudProgress(user.id);
  const merged = remoteProgress ? mergeProgress(localProgress, remoteProgress) : localProgress;
  merged.user_id = user.id;

  await saveCloudProgress(user.id, merged);
  setUserProgress(merged);
  await upsertUserRow(client, user);

  return { ok: true, merged, createdRemote: !remoteProgress };
}

export async function hydrateLocalFromCloud() {
  const user = await getCurrentUser();
  if (!user?.id) return { ok: false, reason: 'no-user' };

  try {
    const remoteProgress = await loadCloudProgress(user.id);
    if (!remoteProgress) return { ok: true, merged: null, source: 'local' };
    const merged = mergeProgress(getUserProgress(), remoteProgress);
    merged.user_id = user.id;
    setUserProgress(merged);
    await saveCloudProgress(user.id, merged);
    return { ok: true, merged, source: 'cloud' };
  } catch (error) {
    console.warn('hydrateLocalFromCloud failed, keeping local progress', error);
    return { ok: false, reason: 'network', error };
  }
}

export async function syncLocalProgressIfLoggedIn() {
  const user = await getCurrentUser();
  if (!user?.id) return { ok: false, reason: 'no-user' };

  try {
    const progress = getUserProgress();
    progress.user_id = user.id;
    setUserProgress(progress);
    await saveCloudProgress(user.id, progress);
    return { ok: true };
  } catch (error) {
    console.warn('syncLocalProgressIfLoggedIn failed, local is unchanged', error);
    return { ok: false, reason: 'network', error };
  }
}
