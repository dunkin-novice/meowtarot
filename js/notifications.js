/**
 * MeowTarot — local notifications module
 * Wraps @capacitor/local-notifications for daily card reminders.
 * All scheduling is local (on-device). No server required.
 */

const NOTIF_ID = 1;
const NOTIF_HOUR = 20;
const NOTIF_PREF_KEY = 'meowtarot_notif_enabled';
const NOTIF_ASKED_KEY = 'meowtarot_notif_asked';

let _plugin = null;

async function getPlugin() {
  if (_plugin) return _plugin;
  try {
    const { LocalNotifications } = await import('./vendor/local-notifications.js');
    _plugin = LocalNotifications;
  } catch {
    _plugin = null;
  }
  return _plugin;
}

export function hasBeenAsked() {
  return !!localStorage.getItem(NOTIF_ASKED_KEY);
}

export function isEnabled() {
  return localStorage.getItem(NOTIF_PREF_KEY) === '1';
}

export async function requestAndSchedule(dict) {
  localStorage.setItem(NOTIF_ASKED_KEY, '1');
  const plugin = await getPlugin();
  if (!plugin) return;

  const perm = await plugin.requestPermissions();
  if (perm.display !== 'granted') return;

  localStorage.setItem(NOTIF_PREF_KEY, '1');
  await scheduleDailyReminder(dict);
}

export async function scheduleDailyReminder(dict) {
  const plugin = await getPlugin();
  if (!plugin || !isEnabled()) return;

  const title = dict?.notifDailyTitle || 'Your card is waiting 🐱';
  const body = dict?.notifDailyBody || 'Take a quiet moment for yourself today.';

  await plugin.cancel({ notifications: [{ id: NOTIF_ID }] }).catch(() => {});

  await plugin.schedule({
    notifications: [
      {
        id: NOTIF_ID,
        title,
        body,
        schedule: {
          on: { hour: NOTIF_HOUR, minute: 0 },
          every: 'day',
          allowWhileIdle: true,
        },
        actionTypeId: 'DAILY_CARD',
        extra: { route: '/daily.html' },
      },
    ],
  });
}

export async function cancelAll() {
  const plugin = await getPlugin();
  if (!plugin) return;
  await plugin.cancel({ notifications: [{ id: NOTIF_ID }] }).catch(() => {});
  localStorage.removeItem(NOTIF_PREF_KEY);
}

export async function initDeepLink() {
  const plugin = await getPlugin();
  if (!plugin) return;
  await plugin.addListener('localNotificationActionPerformed', (action) => {
    const route = action.notification?.extra?.route;
    if (route) window.location.href = route;
  });
}
