import { Router } from 'express'
import { query, queryOne, run, insert } from '../db.js'
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
    `SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
    [req.user.user_id]
  )
  res.json(txns)
})

// POST /api/user-portal/sell-points — sell points back to the user's agent
router.post('/sell-points', requireUserAuth, (req, res) => {
  const { user_id } = req.user
  const { points } = req.body

  if (!points || points <= 0) return res.status(400).json({ error: 'Points must be greater than 0' })

  const user = queryOne('SELECT id, points, agent_id FROM users WHERE id = ?', [user_id])
  if ((user?.points ?? 0) < points) {
    return res.status(400).json({ error: `Insufficient points. You have ${user?.points ?? 0}` })
  }
  if (!user.agent_id) {
    return res.status(400).json({ error: 'Your account is not linked to an agent' })
  }

  const agentUser = queryOne('SELECT id, name, points FROM users WHERE id = ?', [user.agent_id])
  if (!agentUser) return res.status(400).json({ error: 'Agent not found' })

  run('UPDATE users SET points = points - ? WHERE id = ?', [points, user_id])
  run('UPDATE users SET points = points + ? WHERE id = ?', [points, user.agent_id])

  const newBalance = (user.points - points)
  insert('INSERT INTO transactions (user_id, type, amount, balance_after, description) VALUES (?,?,?,?,?)',
    [user_id, 'points_sold', -points, newBalance, `Points sold back to ${agentUser.name}`])
  insert('INSERT INTO transactions (user_id, type, amount, balance_after, description) VALUES (?,?,?,?,?)',
    [user.agent_id, 'points_bought', points, ((agentUser.points ?? 0) + points),
     `Points bought back from player`])

  res.json({ ok: true, remaining_points: newBalance, agent_name: agentUser.name })
})

export default router
