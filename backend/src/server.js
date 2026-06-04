import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { customerRoutes } from './routes/customers.js';
import { projectRoutes } from './routes/projects.js';
import { quoteRoutes } from './routes/quotes.js';
import { serviceRateRoutes } from './routes/serviceRates.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { authRoutes } from './routes/auth.js';
import { productRoutes } from './routes/products.js';
import { providerRoutes } from './routes/providers.js';
import { aiRoutes } from './routes/ai.js';
import { assistantRoutes } from './routes/assistant.js';
import { materialRoutes } from './routes/materials.js';
import { requireAuth } from './utils/auth.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true
});

await app.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.get('/api/health', async () => ({
  status: 'ok',
  service: 'industrial-automation-quoter'
}));

await app.register(authRoutes);

app.addHook('preHandler', async (request, reply) => {
  const publicPaths = ['/api/health', '/api/auth/login'];
  const path = request.url.split('?')[0];
  if (publicPaths.includes(path) || path.startsWith('/api/public/')) return;
  if (request.url.startsWith('/api/')) return requireAuth(request, reply);
});

await app.register(dashboardRoutes);
await app.register(customerRoutes);
await app.register(projectRoutes);
await app.register(quoteRoutes);
await app.register(serviceRateRoutes);
await app.register(productRoutes);
await app.register(providerRoutes);
await app.register(aiRoutes);
await app.register(assistantRoutes);
await app.register(materialRoutes);

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
