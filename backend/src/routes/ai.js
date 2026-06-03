import { generateQuoteAssistantPreview } from '../services/aiQuoteAssistantService.js';

export async function aiRoutes(app) {
  app.post('/api/ai/quote-assistant-preview', async (request, reply) => {
    try {
      return await generateQuoteAssistantPreview(request.body || {});
    } catch (error) {
      request.log.error(error);
      const statusCode = Number(error.statusCode) || 500;
      return reply.code(statusCode).send({
        message: error.message || 'Unable to generate AI quote assistant preview'
      });
    }
  });
}
