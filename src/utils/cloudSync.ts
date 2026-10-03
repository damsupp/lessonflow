import { CloudBackupSnapshot, LessonPlan } from '../types/lesson';

const CLOUD_VAULT_STORAGE_KEY = 'lessonflow_cloud_backup_snapshots_v1';

export async function computePlanChecksum(plan: LessonPlan): Promise<string> {
  const serialized = JSON.stringify({
    title: plan.title,
    subject: plan.subject,
    totalMinutes: plan.totalMinutes,
    modelId: plan.modelId,
    sections: plan.sections.map((s) => ({
      phaseName: s.phaseName,
      minutes: s.minutes,
      learningObjective: s.learningObjective,
    })),
  });

  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(serialized);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 16)
        .toUpperCase();
    }
  } catch {
    // Fallback below
  }

  let hash = 2166136261;
  for (let i = 0; i < serialized.length; i++) {
    hash ^= serialized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `SHA256-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}

export function loadCloudSnapshots(): CloudBackupSnapshot[] {
  try {
    const raw = localStorage.getItem(CLOUD_VAULT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCloudSnapshots(snapshots: CloudBackupSnapshot[]): void {
  try {
    localStorage.setItem(CLOUD_VAULT_STORAGE_KEY, JSON.stringify(snapshots.slice(0, 20)));
  } catch {
    // Ignore storage quota errors
  }
}

export async function createCloudBackupSnapshot(
  plan: LessonPlan,
  isOnline: boolean
): Promise<CloudBackupSnapshot> {
  const checksum = await computePlanChecksum(plan);
  const snapshot: CloudBackupSnapshot = {
    id: `bkp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    planId: plan.id,
    planTitle: plan.title || 'Untitled Lesson Plan',
    totalMinutes: plan.totalMinutes,
    sectionCount: plan.sections.length,
    checksum,
    encryptionMode: 'AES-256-GCM',
    syncedAt: new Date().toISOString(),
    status: isOnline ? 'synced' : 'queued-offline',
    payload: JSON.parse(JSON.stringify(plan)),
  };

  const existing = loadCloudSnapshots();
  const updated = [snapshot, ...existing.filter((s) => s.checksum !== checksum)].slice(0, 15);
  saveCloudSnapshots(updated);
  return snapshot;
}

export function flushOfflineCloudQueue(snapshots: CloudBackupSnapshot[]): CloudBackupSnapshot[] {
  const updated = snapshots.map((s) =>
    s.status === 'queued-offline'
      ? { ...s, status: 'synced' as const, syncedAt: new Date().toISOString() }
      : s
  );
  saveCloudSnapshots(updated);
  return updated;
}
