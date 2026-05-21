// PATCH /api/waifu/[waifuId]/level-up
// Applica la scelta di level-up dell'utente per una waifu.
// Body: { stat: 'tette' | 'taglia_piedi' | 'eta' | 'capelli' | 'esperienza', delta: +1 | -1 }
import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { computeAndSaveStats } from '@/lib/gameLogic';

const STAT_RANGES = {
  tette:          { min: 1,  max: 7    },
  colore_capelli: { min: 1,  max: 10   },
  eta:            { min: 16, max: 5000 },
  taglia_piedi:   { min: 34, max: 45   },
  esperienza:     { min: 0,  max: 5000 },
};
const VALID_STATS = Object.keys(STAT_RANGES);

export async function PATCH(request, { params }) {
  const { waifuId } = await params;

  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  let uid;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { stat, delta } = body;

  if (!VALID_STATS.includes(stat)) {
    return NextResponse.json({ error: `Stat non valida. Valori: ${VALID_STATS.join(', ')}` }, { status: 400 });
  }
  if (delta !== 1 && delta !== -1) {
    return NextResponse.json({ error: 'delta deve essere +1 o -1' }, { status: 400 });
  }

  const [collSnap, waifuSnap, cfgSnap] = await Promise.all([
    adminDb.doc(`users/${uid}/collezione/main`).get(),
    adminDb.doc(`catalogo_waifu/${waifuId}`).get(),
    adminDb.doc('config/rarity_multipliers').get(),
  ]);

  if (!waifuSnap.exists) return NextResponse.json({ error: 'Waifu non trovata' }, { status: 404 });
  const catalog = waifuSnap.data();
  const coll = collSnap.exists ? collSnap.data() : {};
  const userWaifu = coll.waifu?.[waifuId];
  if (!userWaifu) return NextResponse.json({ error: 'Waifu non in collezione' }, { status: 404 });
  if (!userWaifu.levelup_pending) return NextResponse.json({ error: 'Nessun level-up disponibile' }, { status: 422 });

  const currentLevel = userWaifu.livello ?? 1;
  if (currentLevel >= 10) return NextResponse.json({ error: 'Livello massimo raggiunto' }, { status: 422 });

  const statPersonali = userWaifu.stat_personali ?? {};
  const currentValue = statPersonali[stat] ?? catalog[stat] ?? 0;
  const range = STAT_RANGES[stat];
  const newValue = currentValue + delta;

  if (newValue < range.min || newValue > range.max) {
    return NextResponse.json({ error: `${stat} fuori range (${range.min}–${range.max})` }, { status: 422 });
  }

  const newStatPersonali = { ...statPersonali, [stat]: newValue };
  const rarityConfig = cfgSnap.exists ? cfgSnap.data() : null;
  const { velocita, crit_chance, hp } = computeAndSaveStats(catalog, catalog.rarita ?? 'comune', newStatPersonali, rarityConfig);

  await adminDb.doc(`users/${uid}/collezione/main`).update({
    [`waifu.${waifuId}.stat_personali`]:  newStatPersonali,
    [`waifu.${waifuId}.velocita`]:        velocita,
    [`waifu.${waifuId}.crit_chance`]:     crit_chance,
    [`waifu.${waifuId}.hp`]:              hp,
    [`waifu.${waifuId}.livello`]:         currentLevel + 1,
    [`waifu.${waifuId}.levelup_pending`]: false,
  });

  return NextResponse.json({ success: true, livello: currentLevel + 1, velocita, crit_chance, hp, [stat]: newValue });
}
