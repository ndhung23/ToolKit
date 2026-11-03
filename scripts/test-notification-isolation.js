import assert from 'node:assert';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { transformFileSync } from '@babel/core';

const here = path.dirname(fileURLToPath(import.meta.url));
const nodeRequire = createRequire(import.meta.url);
const source = path.join(here, '..', 'src', 'features', 'screentime', 'ScreenTimeContext.js');
const transformed = transformFileSync(source, { presets: ['babel-preset-expo'] }).code;
const cancelled = [];
const notifications = {
  AndroidNotificationPriority: { HIGH: 1 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
  setNotificationHandler() {},
  getAllScheduledNotificationsAsync: async () => [
    { identifier: 'screen-1', content: { data: { managedBy: 'screen-time' } } },
    { identifier: 'habit-1', content: { data: { managedBy: 'micro-habit' } } },
    { identifier: 'fap-1', content: { data: { type: 'FAP_SLOT_REMINDER' } } },
  ],
  cancelScheduledNotificationAsync: async (id) => { cancelled.push(id); },
};
const module = { exports: {} };
vm.runInNewContext(transformed, {
  module, exports: module.exports, console, Date, Promise, setTimeout, clearTimeout,
  require: (name) => {
    if (name === 'react') return { createContext: () => ({}), useContext() {}, useEffect() {}, useRef: (value) => ({ current: value }), useState: (value) => [value, () => {}] };
    if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
    if (name === 'react-native') return { Alert: { alert() {} }, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) }, Platform: { OS: 'ios' } };
    if (name.includes('utils/storage')) return {};
    if (name === 'expo-notifications') return notifications;
    if (name.startsWith('@babel/runtime/')) return nodeRequire(name);
    throw new Error(`Unexpected module: ${name}`);
  },
});

await module.exports.cancelScreenTimeReminders();
assert.deepEqual(cancelled, ['screen-1']);
console.log('[PASS] Screen Time only cancels its own notification.');
console.log('[PASS] Micro-habit and FAP notifications survive app background/re-scheduling.');
