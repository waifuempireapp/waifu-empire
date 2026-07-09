// GET /api/negozio/config — prezzi del negozio (beni con Kisses + tagli ricarica).
// Legge i prezzi correnti (Firestore config/prezzi con fallback ai default) e
// li normalizza nel formato atteso da UI: { beni, tagli_kisses }.
import { defineEventHandler } from 'h3'
import { getPrezzi } from '../../utils/prezziServer'

export default defineEventHandler(async () => {
  const p = await getPrezzi()
  return {
    prezzi: {
      beni: {
        pack_sfida:    { kisses: p.beni.pack_sfida.kisses },
        pack_sfida_10: { kisses: p.beni.pack_sfida_10?.kisses ?? 450 },
        energia:       { kisses: p.beni.energia.kisses },
        pass_hard:     { kisses: p.pass_hard.kisses },
        trade_pass:    { kisses: p.pass_scambi.kisses },
      },
      tagli_kisses: [
        { id: 'xs', ...p.tagli_kisses.xs },
        { id: 'sm', ...p.tagli_kisses.sm },
        { id: 'md', ...p.tagli_kisses.md },
        { id: 'lg', ...p.tagli_kisses.lg },
      ],
    },
  }
})
