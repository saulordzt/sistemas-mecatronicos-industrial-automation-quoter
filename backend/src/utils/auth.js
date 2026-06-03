import jwt from 'jsonwebtoken';

export const jwtSecret = process.env.JWT_SECRET || 'change-this-development-secret';
export const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '8h';

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name || user.email
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
}

export async function requireAuth(request, reply) {
  const authHeader = request.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return reply.code(401).send({ message: 'Authentication required' });
  }

  try {
    request.user = jwt.verify(token, jwtSecret);
  } catch (_error) {
    return reply.code(401).send({ message: 'Invalid or expired token' });
  }
}
