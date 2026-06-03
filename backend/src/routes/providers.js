import { providerRepository } from '../repositories/providerRepository.js';
import { deleted, notFound } from '../utils/http.js';

export async function providerRoutes(app) {
  app.get('/api/providers', async () => providerRepository.list());

  app.post('/api/providers', async (request, reply) => {
    const provider = await providerRepository.create(request.body);
    return reply.code(201).send(provider);
  });

  app.get('/api/providers/:id', async (request, reply) => {
    const provider = await providerRepository.findById(request.params.id);
    return provider || notFound(reply, 'Provider');
  });

  app.put('/api/providers/:id', async (request, reply) => {
    const provider = await providerRepository.update(request.params.id, request.body);
    return provider || notFound(reply, 'Provider');
  });

  app.delete('/api/providers/:id', async (request, reply) => {
    await providerRepository.remove(request.params.id);
    return deleted(reply);
  });
}
