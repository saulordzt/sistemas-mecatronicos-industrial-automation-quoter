import { projectRepository } from '../repositories/projectRepository.js';
import { deleted, notFound } from '../utils/http.js';

export async function projectRoutes(app) {
  app.get('/api/projects', async () => projectRepository.list());

  app.post('/api/projects', async (request, reply) => {
    const project = await projectRepository.create(request.body);
    return reply.code(201).send(project);
  });

  app.get('/api/projects/:id', async (request, reply) => {
    const project = await projectRepository.findById(request.params.id);
    return project || notFound(reply, 'Project');
  });

  app.put('/api/projects/:id', async (request, reply) => {
    const project = await projectRepository.update(request.params.id, request.body);
    return project || notFound(reply, 'Project');
  });

  app.delete('/api/projects/:id', async (request, reply) => {
    await projectRepository.remove(request.params.id);
    return deleted(reply);
  });
}
