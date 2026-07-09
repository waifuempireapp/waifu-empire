// GET /api/notifiche/list — notifiche dell'utente.
// Prima assicura la chiusura mensile della classifica (idempotente) e
// riconcilia gli aumenti di rarità per l'utente (crea le notifiche se
// possiede la carta vincitrice), poi restituisce la lista.
import { defineEventHandler, getHeader, createError } from 'h3'
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin'
import { ensureMonthlyClosure, reconcileUserUpgrades } from '../../utils/rankingClosure'

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '')
  if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' })
  let uid: string
  try { uid = (await getAdminAuth().verifyIdToken(token)).uid }
  catch { throw createError({ statusCode: 401, message: 'Token non valido' }) }

  try { await ensureMonthlyClosure() } catch (e) { console.error('[notifiche] closure', e) }
  try { await reconcileUserUpgrades(uid) } catch (e) { console.error('[notifiche] reconcile', e) }

  const db = getAdminDb()
  const snap = await db.collection(`users/${uid}/notifiche`)
    .orderBy('createdAt', 'desc').limit(50).get()
  const notifiche = snap.docs.map(d => {
    const x = d.data() as any
    return {
      id: d.id, tipo: x.tipo ?? 'info',
      waifuId: x.waifuId ?? null, nome: x.nome ?? null,
      oldRarita: x.oldRarita ?? null, newRarita: x.newRarita ?? null,
      monthKey: x.monthKey ?? null, image: x.image ?? null,
      read: !!x.read,
      createdAt: x.createdAt?.toMillis?.() ?? null,
    }
  })
  return { notifiche, unread: notifiche.filter(n => !n.read).length }
})
