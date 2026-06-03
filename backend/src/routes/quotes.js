import { quoteRepository } from '../repositories/quoteRepository.js';
import { deleted, notFound } from '../utils/http.js';

export async function quoteRoutes(app) {
  app.get('/api/public/quotes/:id', async (request, reply) => {
    const quote = await quoteRepository.findById(request.params.id);
    if (!quote || quote.status === 'Cancelled') return notFound(reply, 'Quote');
    return quote;
  });

  app.post('/api/public/quotes/:id/pdf-download', async (request, reply) => {
    const quote = await quoteRepository.findById(request.params.id);
    if (!quote || quote.status === 'Cancelled') return notFound(reply, 'Quote');
    const current = Number(quote.clientPdfDownloadCount || 0);
    const updated = await quoteRepository.update(request.params.id, {
      clientPdfDownloadCount: current + 1,
      lastClientPdfDownloadAt: new Date()
    });
    return {
      clientPdfDownloadCount: updated?.clientPdfDownloadCount || current + 1,
      lastClientPdfDownloadAt: updated?.lastClientPdfDownloadAt
    };
  });

  app.get('/api/quotes', async () => quoteRepository.list());

  app.post('/api/quotes', async (request, reply) => {
    const quote = await quoteRepository.createQuote(request.body);
    return reply.code(201).send(quote);
  });

  app.get('/api/quotes/:id', async (request, reply) => {
    const quote = await quoteRepository.findById(request.params.id);
    return quote || notFound(reply, 'Quote');
  });

  app.put('/api/quotes/:id', async (request, reply) => {
    const quote = await quoteRepository.update(request.params.id, request.body);
    return quote || notFound(reply, 'Quote');
  });

  app.delete('/api/quotes/:id', async (request, reply) => {
    await quoteRepository.remove(request.params.id);
    return deleted(reply);
  });

  app.post('/api/quotes/:id/duplicate', async (request, reply) => {
    const quote = await quoteRepository.duplicate(request.params.id);
    return quote ? reply.code(201).send(quote) : notFound(reply, 'Quote');
  });

  app.get('/api/quotes/:id/family', async (request, reply) => {
    const quotes = await quoteRepository.listFamilyMembers(request.params.id);
    return quotes || notFound(reply, 'Quote');
  });

  app.post('/api/quotes/:id/revise', async (request, reply) => {
    const quote = await quoteRepository.createRevision(request.params.id);
    return quote ? reply.code(201).send(quote) : notFound(reply, 'Quote');
  });

  app.post('/api/quotes/:id/variant', async (request, reply) => {
    const quote = await quoteRepository.createVariant(request.params.id, request.body || {});
    return quote ? reply.code(201).send(quote) : notFound(reply, 'Quote');
  });
}
