import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { requireUserAuth } from '../middleware/userAuth.js'

const router = Router()

// GET /api/user-portal/me
router.get('/me', requireUserAuth, (req, res) => {
  const user = queryOne(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.points, u.status, u.created_at,
       a.name as agent_name, a.email as agent_email
     FROM users u
     LEFT JOIN users a ON a.id = u.agent_id
     WHERE u.id = ?`,
    [req.user.user_id]
  )
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json(user)
})

// GET /api/user-portal/tickets
router.get('/tickets', requireUserAuth, (req, res) => {
  const tickets = query(
    `SELECT t.*, d.title as draw_title, d.draw_date, d.draw_time, d.status as draw_status
     FROM tickets t
     JOIN draws d ON d.id = t.draw_id
     WHERE t.user_id = ?
     ORDER BY t.created_at DESC LIMIT 50`,
    [req.user.user_id]
  )
  res.json(tickets)
})

// GET /api/user-portal/transactions
router.get('/transactions', requireUserAuth, (req, res) => {
  const txns = query(
    `SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
    [req.user.user_id]
  )
  res.json(txns)
})

export default router
