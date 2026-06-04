import { assistantSessionRepository } from '../repositories/assistantSessionRepository.js';
import { assistantAttachmentRepository } from '../repositories/assistantAttachmentRepository.js';
import { quoteRepository } from '../repositories/quoteRepository.js';
import { saveAssistantFile } from '../utils/assistantStorage.js';
import {
  addAssistantMessage,
  createAssistantSession,
  createOrUpdateDraftQuote,
  getAssistantSessionDetail,
  processAssistantSession
} from '../services/assistantService.js';
import { notFound } from '../utils/http.js';

export async function assistantRoutes(app) {
  app.get('/api/assistant/sessions', async (request) => assistantSessionRepository.listByUser(request.user.sub));

  app.post('/api/assistant/sessions', async (request, reply) => {
    const session = await createAssistantSession({
      userId: request.user.sub,
      title: request.body?.title
    });
    return reply.code(201).send(session);
  });

  app.get('/api/assistant/sessions/:id', async (request, reply) => {
    const session = await getAssistantSessionDetail(request.params.id, request.user.sub);
    return session || notFound(reply, 'Assistant session');
  });

  app.post('/api/assistant/sessions/:id/messages', async (request, reply) => {
    const message = await addAssistantMessage({
      sessionId: request.params.id,
      userId: request.user.sub,
      content: request.body?.content
    });
    return message ? reply.code(201).send(message) : notFound(reply, 'Assistant session');
  });

  app.post('/api/assistant/sessions/:id/attachments', async (request, reply) => {
    const session = await getAssistantSessionDetail(request.params.id, request.user.sub);
    if (!session) return notFound(reply, 'Assistant session');

    const uploaded = [];
    const parts = request.files ? request.files() : [];
    for await (const file of parts) {
      const buffer = await file.toBuffer();
      const storagePath = await saveAssistantFile({
        sessionId: session.id,
        filename: file.filename,
        buffer
      });
      const attachment = await assistantAttachmentRepository.create({
        sessionId: session.id,
        userId: request.user.sub,
        originalName: file.filename,
        mimeType: file.mimetype,
        size: file.file.bytesRead || buffer.length,
        storagePath,
        status: 'uploaded',
        summary: '',
        extractedText: '',
        warnings: []
      });
      uploaded.push(attachment);
    }

    return reply.code(201).send(uploaded);
  });

  app.post('/api/assistant/sessions/:id/process', async (request, reply) => {
    const session = await processAssistantSession({
      sessionId: request.params.id,
      userId: request.user.sub
    });
    return session || notFound(reply, 'Assistant session');
  });

  app.post('/api/assistant/sessions/:id/create-or-update-draft', async (request, reply) => {
    const result = await createOrUpdateDraftQuote({
      sessionId: request.params.id,
      userId: request.user.sub
    });
    return result || notFound(reply, 'Assistant session');
  });

  app.get('/api/assistant/sessions/:id/draft-quote', async (request, reply) => {
    const session = await getAssistantSessionDetail(request.params.id, request.user.sub);
    if (!session) return notFound(reply, 'Assistant session');
    if (!session.draftQuoteId) return reply.code(404).send({ message: 'Draft quote not found' });
    const quote = await quoteRepository.findById(session.draftQuoteId);
    return quote || notFound(reply, 'Quote');
  });
}
