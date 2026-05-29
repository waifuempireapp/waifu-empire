// PATCH /api/waifu/[waifuId]/level-up
// Applica la scelta di level-up dell'utente per una waifu.
// Body: { stat: 'tette' | 'taglia_piedi' | 'eta' | 'capelli' | 'esperienza', delta: +1 | -1 }
import { defineEventHandler, getHeader, getRouterParam, readBody, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../../utils/firebaseAdmin';
import { computeAndSaveStats } from '../../../utils/gameLogic';

const STAT_RANGES: Record<string, { min: number; max: number }> = {
  tette:          { min: 1,  max: 7    },
  colore_capelli: { min: 1,  max: 10   },
  eta:            { min: 16, max: 5000 },
  taglia_piedi:   { min: 34, max: 45   },
  esperienza:     { min: 0,  max: 5000 },
};
const VALID_STATS = Object.keys(STAT_RANGES);

export default defineEventHandler(async (event) => {
  const waifuId = getRouterParam(event, 'waifuId') as string;

  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
  if (!token) throw createError({ statusCode: 401, message: 'Non autenticato' });

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    throw createError({ statusCode: 401, message: 'Token non valido' });
  }

  const body = await readBody(event).catch(() => ({}));
  const { stat, delta } = body as { stat: string; delta: number };

  if (!VALID_STATS.includes(stat)) {
    throw createError({ statusCode: 400, message: `Stat non valida. Valori: ${VALID_STATS.join(', ')}` });
  }
  if (delta !== 1 && delta !== -1) {
    throw createError({ statusCode: 400, message: 'delta deve essere +1 o -1' });
  }

  const adminDb = getAdminDb();
  const [collSnap, waifuSnap, cfgSnap] = await Promise.all([
    adminDb.doc(`users/${uid}/collezione/main`).get(),
    adminDb.doc(`catalogo_waifu/${waifuId}`).get(),
    adminDb.doc('config/rarity_multipliers').get(),
  ]);

  if (!waifuSnap.exists) throw createError({ statusCode: 404, message: 'Waifu non trovata' });
  const catalog = waifuSnap.data()!;
  const coll = collSnap.exists ? collSnap.data()! : {};
  const userWaifu = (coll as any).waifu?.[waifuId];
  if (!userWaifu) throw createError({ statusCode: 404, message: 'Waifu non in collezione' });
  if (!userWaifu.levelup_pending) throw createError({ statusCode: 422, message: 'Nessun level-up disponibile' });

  const currentLevel: number = userWaifu.livello ?? 1;
  if (currentLevel >= 10) throw createError({ statusCode: 422, message: 'Livello massimo raggiunto' });

  const statPersonali = userWaifu.stat_personali ?? {};
  const currentValue: number = statPersonali[stat] ?? catalog[stat] ?? 0;
  const range = STAT_RANGES[stat];
  const newValue: number = currentValue + delta;

  if (newValue < range.min || newValue > range.max) {
    throw createError({ statusCode: 422, message: `${stat} fuori range (${range.min}–${range.max})` });
  }

  const newStatPersonali = { ...statPersonali, [stat]: newValue };
  const rarityConfig = cfgSnap.exists ? cfgSnap.data()! : null;
  const { velocita, crit_chance, hp } = computeAndSaveStats(catalog, catalog.rarita ?? 'comune', newStatPersonali, rarityConfig);

  await adminDb.doc(`users/${uid}/collezione/main`).update({
    [`waifu.${waifuId}.stat_personali`]:  newStatPersonali,
    [`waifu.${waifuId}.velocita`]:        velocita,
    [`waifu.${waifuId}.crit_chance`]:     crit_chance,
    [`waifu.${waifuId}.hp`]:              hp,
    [`waifu.${waifuId}.livello`]:         currentLevel + 1,
    [`waifu.${waifuId}.levelup_pending`]: false,
  });

  return { success: true, livello: currentLevel + 1, velocita, crit_chance, hp, [stat]: newValue };
});
