import { serviceRateRepository } from '../repositories/serviceRateRepository.js';
import { deleted, notFound } from '../utils/http.js';

export async function serviceRateRoutes(app) {
  app.get('/api/service-rates', async () => serviceRateRepository.list());

  app.post('/api/service-rates', async (request, reply) => {
    const rate = await serviceRateRepository.create(request.body);
    return reply.code(201).send(rate);
  });

  app.put('/api/service-rates/:id', async (request, reply) => {
    const rate = await serviceRateRepository.update(request.params.id, request.body);
    return rate || notFound(reply, 'Service rate');
  });

  app.delete('/api/service-rates/:id', async (request, reply) => {
    await serviceRateRepository.remove(request.params.id);
    return deleted(reply);
  });
}
