import { Router } from 'express'
import { query, queryOne, run, insert } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /api/system-tickets
router.get('/', requireAuth, (req, res) => {
  const entries = query(
    `SELECT st.*, d.title as draw_title, d.draw_date, d.draw_time
     FROM system_tickets st
     LEFT JOIN draws d ON d.id = st.draw_id
     ORDER BY st.created_at DESC`
  )
  const summary = queryOne(
    `SELECT COUNT(*) as total_entries,
            SUM(ticket_count) as total_tickets,
            SUM(win_amount)   as total_wins
     FROM system_tickets`
  )
  res.json({ entries, summary })
})

// GET /api/system-tickets/draws — all draws for the selector
router.get('/draws', requireAuth, (req, res) => {
  const draws = query(
    `SELECT id, title, draw_date, draw_time, type, status
     FROM draws ORDER BY draw_date DESC, draw_time DESC LIMIT 200`
  )
  res.json(draws)
})

// POST /api/system-tickets
router.post('/', requireAuth, (req, res) => {
  const { draw_id, draw_label, ticket_count, win_amount = 0, winning_ticket_ids, notes } = req.body
  if (!ticket_count || ticket_count < 1) {
    return res.status(400).json({ error: 'Ticket count must be at least 1' })
  }
  if (!draw_label) {
    return res.status(400).json({ error: 'Draw label is required' })
  }
  const id = insert(
    `INSERT INTO system_tickets (draw_id, draw_label, ticket_count, win_amount, winning_ticket_ids, notes)
     VALUES (?,?,?,?,?,?)`,
    [draw_id ?? null, draw_label, ticket_count, win_amount ?? 0,
     winning_ticket_ids?.trim() || null, notes ?? null]
  )
  res.json({ ok: true, id })
})

// PUT /api/system-tickets/:id — update win amount, ticket IDs or notes
router.put('/:id', requireAuth, (req, res) => {
  const row = queryOne('SELECT * FROM system_tickets WHERE id = ?', [req.params.id])
  if (!row) return res.status(404).json({ error: 'Entry not found' })
  const { win_amount, ticket_count, winning_ticket_ids, notes } = req.body
  run(
    'UPDATE system_tickets SET win_amount=?, ticket_count=?, winning_ticket_ids=?, notes=? WHERE id=?',
    [
      win_amount          !== undefined ? win_amount          : row.win_amount,
      ticket_count        !== undefined ? ticket_count        : row.ticket_count,
      winning_ticket_ids  !== undefined ? (winning_ticket_ids?.trim() || null) : row.winning_ticket_ids,
      notes               !== undefined ? notes               : row.notes,
      req.params.id,
    ]
  )
  res.json({ ok: true })
})

// DELETE /api/system-tickets/:id
router.delete('/:id', requireAuth, (req, res) => {
  run('DELETE FROM system_tickets WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

export default router
