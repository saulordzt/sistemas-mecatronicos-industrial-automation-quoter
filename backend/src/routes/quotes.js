import { quoteRepository } from '../repositories/quoteRepository.js';
import { customerRepository } from '../repositories/customerRepository.js';
import { deleted, notFound } from '../utils/http.js';
import { getCustomerContact, normalizeCustomer } from '../utils/customerContacts.js';
import { buildClientQuoteUrl } from '../utils/quoteSharing.js';
import { sendQuoteClientLinkEmail } from '../services/mailService.js';

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

  app.post('/api/quotes/:id/send-client-link', async (request, reply) => {
    const quote = await quoteRepository.findById(request.params.id);
    if (!quote || quote.status === 'Cancelled') return notFound(reply, 'Quote');

    const customer = await customerRepository.findById(quote.customerId);
    if (!customer) return reply.code(400).send({ message: 'Customer not found for quote' });

    const normalizedCustomer = normalizeCustomer(customer);
    const contactIds = Array.isArray(request.body?.contactIds) ? request.body.contactIds : [];
    const recipients = normalizedCustomer.contacts.filter((contact) => contactIds.includes(contact.id));
    if (!recipients.length) {
      return reply.code(400).send({ message: 'Select at least one saved customer contact' });
    }

    const resolvedRecipient = getCustomerContact(normalizedCustomer, quote.recipientContactId);
    const customerSnapshot = {
      ...normalizedCustomer,
      selectedContact: resolvedRecipient,
      recipientContact: resolvedRecipient
    };

    const projectName = quote.projectSnapshot?.projectName ? ` para el proyecto ${quote.projectSnapshot.projectName}` : '';
    const subject = String(request.body?.subject || `Cotizacion ${quote.quoteNumber} - Sistemas Mecatronicos`).trim();
    const message = String(request.body?.message || `Compartimos la liga de la cotizacion ${quote.quoteNumber}${projectName}.`).trim();
    const clientUrl = buildClientQuoteUrl(quote.id);

    await sendQuoteClientLinkEmail({
      quote: { ...quote, customerSnapshot },
      company: request.body?.company || {},
      recipients,
      subject,
      message,
      clientUrl
    });

    const updated = await quoteRepository.update(quote.id, {
      clientEmailSendCount: Number(quote.clientEmailSendCount || 0) + 1,
      lastClientEmailSentAt: new Date(),
      lastClientEmailRecipients: recipients.map((contact) => ({ id: contact.id, name: contact.name, email: contact.email })),
      recipientContactId: quote.recipientContactId || normalizedCustomer.primaryContactId || null
    });

    return {
      clientEmailSendCount: updated?.clientEmailSendCount || Number(quote.clientEmailSendCount || 0) + 1,
      lastClientEmailSentAt: updated?.lastClientEmailSentAt,
      lastClientEmailRecipients: updated?.lastClientEmailRecipients || recipients
    };
  });
}
