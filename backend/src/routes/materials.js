import { extractMaterialFromUrl } from '../services/materialUrlService.js';

export async function materialRoutes(app) {
  app.post('/api/materials/extract-from-url', async (request, reply) => {
    try {
      const result = await extractMaterialFromUrl(request.body || {});
      return result;
    } catch (error) {
      return reply.code(error.statusCode || 500).send({
        message: error.message || 'No fue posible extraer la informacion del material'
      });
    }
  });
}
