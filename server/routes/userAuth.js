import { Router } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { queryOne, insert } from '../db.js'
import { USER_JWT_SECRET } from '../middleware/userAuth.js'

const router = Router()

// POST /api/user-auth/register — self-registration (system users)
router.post('/register', async (req, res) => {
  const { name, email, phone, password } = req.body
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' })
  }

  const existing = queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()])
  if (existing) return res.status(400).json({ error: 'Email already registered' })

  const hash = await bcrypt.hash(password, 10)
  const userId = insert(
    'INSERT INTO users (name, email, phone, role, password_hash) VALUES (?,?,?,?,?)',
    [name.trim(), email.toLowerCase().trim(), phone?.trim() ?? null, 'player', hash]
  )

  const token = jwt.sign(
    { user_id: userId, name: name.trim(), role: 'player', registered_by: 'self' },
    USER_JWT_SECRET,
    { expiresIn: '12h' }
  )

  res.json({ token, name: name.trim(), email: email.toLowerCase().trim(), role: 'player' })
})

// POST /api/user-auth/login — login for both system users and agent-created users
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  const user = queryOne(
    "SELECT * FROM users WHERE email = ? AND status = 'active'",
    [email.toLowerCase().trim()]
  )
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })
  if (!user.password_hash) {
    return res.status(401).json({ error: 'No password set — contact your agent to set a password' })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

  const registeredBy = user.agent_id ? 'agent' : 'self'

  const token = jwt.sign(
    { user_id: user.id, name: user.name, role: user.role, registered_by: registeredBy },
    USER_JWT_SECRET,
    { expiresIn: '12h' }
  )

  res.json({
    token,
    name:          user.name,
    email:         user.email,
    role:          user.role,
    registered_by: registeredBy,
    points:        user.points ?? 0,
  })
})

export default router
