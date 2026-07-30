// Offline Manager — caches game data locally, queues writes, syncs when back online

import { supabase } from './supabase';

const CACHE_PREFIX = 'wandr_cache_';
const QUEUE_KEY = 'wandr_sync_queue';
const PHOTO_PREFIX = 'wandr_photo_';

// ── Cache game data ──────────────────────────────────────────
export async function cacheGameData(raceId: string) {
  try {
    const [race, legs, checkpoints] = await Promise.all([
      supabase.from('races').select().eq('id', raceId).single(),
      supabase.from('legs').select().eq('race_id', raceId).order('order_num'),
      supabase.from('checkpoints').select().order('order_num'),
    ]);

    const legIds = (legs.data || []).map((l: any) => l.id);
    const filteredCps = (checkpoints.data || []).filter((cp: any) => legIds.includes(cp.leg_id));

    const cached = {
      race: race.data,
      legs: legs.data || [],
      checkpoints: filteredCps,
      cachedAt: Date.now(),
    };

    localStorage.setItem(CACHE_PREFIX + raceId, JSON.stringify(cached));
    return cached;
  } catch (err) {
    console.warn('Failed to cache game data:', err);
    return null;
  }
}

export function getCachedGameData(raceId: string) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + raceId);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearGameCache(raceId: string) {
  localStorage.removeItem(CACHE_PREFIX + raceId);
  // Clear associated photos
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(PHOTO_PREFIX + raceId)) {
      localStorage.removeItem(key);
    }
  }
}

// ── Offline progress queue ───────────────────────────────────
type QueuedAction = {
  id: string;
  type: 'complete_checkpoint';
  teamId: string;
  checkpointId: string;
  status: string;
  proof: string;
  timestamp: number;
};

function getQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveQueue(queue: QueuedAction[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function queueProgress(teamId: string, checkpointId: string, status: string, proof: string) {
  const queue = getQueue();
  queue.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    type: 'complete_checkpoint',
    teamId,
    checkpointId,
    status,
    proof: proof.startsWith('data:image') ? 'photo_queued' : proof, // Don't store full base64 in queue
    timestamp: Date.now(),
  });
  saveQueue(queue);

  // Store photo separately if it's a base64 image
  if (proof.startsWith('data:image')) {
    try {
      localStorage.setItem(PHOTO_PREFIX + checkpointId, proof);
    } catch (e) {
      // localStorage might be full — try IndexedDB as fallback
      storePhotoIDB(checkpointId, proof);
    }
  }
}

export function getQueueLength(): number {
  return getQueue().length;
}

// ── Sync queue to Supabase ───────────────────────────────────
export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  const queue = getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remaining: QueuedAction[] = [];

  for (const action of queue) {
    try {
      if (action.type === 'complete_checkpoint') {
        // Retrieve photo if it was queued
        let proof = action.proof;
        if (proof === 'photo_queued') {
          proof = localStorage.getItem(PHOTO_PREFIX + action.checkpointId)
            || await getPhotoIDB(action.checkpointId)
            || 'photo_lost';
        }

        const { error } = await supabase.from('progress').insert({
          team_id: action.teamId,
          checkpoint_id: action.checkpointId,
          status: action.status,
          proof,
        });

        if (error) {
          // If duplicate (already synced), skip it
          if (error.code === '23505') { synced++; }
          else { remaining.push(action); failed++; }
        } else {
          synced++;
          // Clean up stored photo
          localStorage.removeItem(PHOTO_PREFIX + action.checkpointId);
          deletePhotoIDB(action.checkpointId);
        }
      }
    } catch {
      remaining.push(action);
      failed++;
    }
  }

  saveQueue(remaining);
  return { synced, failed };
}

// ── Local progress tracking ──────────────────────────────────
// Track progress locally so the game works offline
const LOCAL_PROGRESS_PREFIX = 'wandr_progress_';

export function getLocalProgress(teamId: string): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_PROGRESS_PREFIX + teamId);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

export function addLocalProgress(teamId: string, checkpointId: string) {
  const progress = getLocalProgress(teamId);
  progress.add(checkpointId);
  localStorage.setItem(LOCAL_PROGRESS_PREFIX + teamId, JSON.stringify(Array.from(progress)));
}

// ── Online/Offline detection ─────────────────────────────────
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function onConnectionChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

// ── IndexedDB fallback for photos ────────────────────────────
function openPhotoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('wandr_photos', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('photos', { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storePhotoIDB(checkpointId: string, data: string) {
  try {
    const db = await openPhotoDB();
    const tx = db.transaction('photos', 'readwrite');
    tx.objectStore('photos').put({ id: checkpointId, data });
  } catch {}
}

async function getPhotoIDB(checkpointId: string): Promise<string | null> {
  try {
    const db = await openPhotoDB();
    return new Promise((resolve) => {
      const tx = db.transaction('photos', 'readonly');
      const req = tx.objectStore('photos').get(checkpointId);
      req.onsuccess = () => resolve(req.result?.data || null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function deletePhotoIDB(checkpointId: string) {
  try {
    const db = await openPhotoDB();
    const tx = db.transaction('photos', 'readwrite');
    tx.objectStore('photos').delete(checkpointId);
  } catch {}
}
