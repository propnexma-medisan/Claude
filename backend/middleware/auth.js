const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'syndic_secret_key_2024_secure';
const JWT_EXPIRES = '7d';

function authenticate(req, res, next) {
  let token = null;

  // Check Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // Check cookie as fallback
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentification requise' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé : rôle insuffisant' });
    }
    next();
  };
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      copropriete_id: user.copropriete_id,
      lot_id: user.lot_id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      is_membre_bureau: user.is_membre_bureau || 0,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

module.exports = { authenticate, requireRole, signToken, JWT_SECRET };
