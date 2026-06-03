import { quoteRepository } from '../repositories/quoteRepository.js';

export async function dashboardRoutes(app) {
  app.get('/api/dashboard', async () => {
    const quotes = await quoteRepository.list();
    const totalQuotedAmount = quotes.reduce((sum, quote) => sum + Number(quote.totals?.finalTotal || 0), 0);

    return {
      totalQuotes: quotes.length,
      draftQuotes: quotes.filter((quote) => quote.status === 'Draft').length,
      approvedQuotes: quotes.filter((quote) => quote.status === 'Approved').length,
      totalQuotedAmount,
      recentQuotes: quotes.slice(0, 8)
    };
  });
}
