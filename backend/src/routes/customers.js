import { customerRepository } from '../repositories/customerRepository.js';
import { deleted, notFound } from '../utils/http.js';

export async function customerRoutes(app) {
  app.get('/api/customers', async () => customerRepository.list());

  app.post('/api/customers', async (request, reply) => {
    const customer = await customerRepository.create(request.body);
    return reply.code(201).send(customer);
  });

  app.get('/api/customers/:id', async (request, reply) => {
    const customer = await customerRepository.findById(request.params.id);
    return customer || notFound(reply, 'Customer');
  });

  app.put('/api/customers/:id', async (request, reply) => {
    const customer = await customerRepository.update(request.params.id, request.body);
    return customer || notFound(reply, 'Customer');
  });

  app.delete('/api/customers/:id', async (request, reply) => {
    await customerRepository.remove(request.params.id);
    return deleted(reply);
  });
}
