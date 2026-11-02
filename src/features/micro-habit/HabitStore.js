// Single source of truth for list, TaskSheet and notification reconciliation.
import { loadHabits, saveHabits } from './microHabitService';

let habits = [];
let loaded = false;
let loading = null;
const listeners = new Set();

function emit() { listeners.forEach((listener) => listener(habits)); }

export async function ensureHabitsLoaded() {
  if (loaded) return habits;
  if (!loading) loading = loadHabits().then((items) => { habits = items; loaded = true; emit(); return habits; }).finally(() => { loading = null; });
  return loading;
}

export function getHabits() { return habits; }
export function subscribeHabits(listener) { listeners.add(listener); if (loaded) listener(habits); return () => listeners.delete(listener); }

export async function setHabits(next) {
  habits = next;
  loaded = true;
  emit();
  await saveHabits(next);
  return habits;
}

export async function updateHabit(id, updater) {
  await ensureHabitsLoaded();
  return setHabits(habits.map((item) => item.id === id ? updater(item) : item));
}
