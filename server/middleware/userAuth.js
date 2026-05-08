import jwt from 'jsonwebtoken'

export const USER_JWT_SECRET = process.env.USER_JWT_SECRET || 'themis-user-portal-2026'

export function requireUserAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No token' })
  try {
    req.user = jwt.verify(token, USER_JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
