import bcrypt from 'bcryptjs';
import { userRepository } from '../repositories/userRepository.js';
import { signToken } from '../utils/auth.js';

export async function authRoutes(app) {
  app.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body || {};
    const user = await userRepository.findByEmail(email);

    if (!user || !user.active) {
      return reply.code(401).send({ message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(String(password || ''), user.passwordHash || '');
    if (!valid) {
      return reply.code(401).send({ message: 'Invalid email or password' });
    }

    const publicUser = { id: user.id, email: user.email, name: user.name };
    return { token: signToken(user), user: publicUser };
  });
}
