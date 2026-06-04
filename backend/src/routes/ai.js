import { generateQuoteAssistantPreview } from '../services/aiQuoteAssistantService.js';
import { reviewQuoteWithAi } from '../services/aiQuoteReviewService.js';

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

  app.post('/api/ai/quote-review-chat', async (request, reply) => {
    try {
      return await reviewQuoteWithAi(request.body || {});
    } catch (error) {
      request.log.error(error);
      const statusCode = Number(error.statusCode) || 500;
      return reply.code(statusCode).send({
        message: error.message || 'Unable to review quote with AI'
      });
    }
  });
}
