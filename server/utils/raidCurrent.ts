// Helper condiviso: il raid del CICLO corrente. Un raid dura 6h (endsAt); dentro
// la finestra resta "il raid corrente" anche se il boss è già stato abbattuto
// (status 'completed') → in quel caso i client mostrano il countdown al prossimo.
// Quando la finestra è passata (endsAt < now) il ciclo è chiuso → chi chiama
// (raid/current) ne crea uno nuovo.
import type { Firestore } from 'firebase-admin/firestore';

export interface CurrentRaid {
  id: string;
  data: Record<string, any>;
  endsMs: number;
  completed: boolean;   // boss abbattuto (HP 0 / status completed)
  expired: boolean;     // finestra 6h conclusa → serve un nuovo raid
}

function toMs(v: any): number {
  if (!v) return 0;
  if (v.toDate) return v.toDate().getTime();
  return new Date(v).getTime();
}

// Ritorna l'ultimo raid creato (per startedAt) se rientra ancora nella finestra
// corrente, con i flag completed/expired. Null se non esiste alcun raid.
export async function getCurrentRaid(adminDb: Firestore): Promise<CurrentRaid | null> {
  const snap = await adminDb.collection('raid_events')
    .orderBy('startedAt', 'desc').limit(1).get();
  if (snap.empty) return null;

  const doc = snap.docs[0];
  const data = doc.data() as Record<string, any>;
  const endsMs = toMs(data.endsAt);
  const now = Date.now();
  const completed = data.status === 'completed' || (data.currentHp ?? 1) <= 0;
  const expired = endsMs > 0 && endsMs < now;

  return { id: doc.id, data, endsMs, completed, expired };
}
