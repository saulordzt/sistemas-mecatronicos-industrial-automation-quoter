export function buildClientQuoteUrl(quoteId) {
  const appUrl = process.env.APP_URL || 'https://cotizar.sistemasmecatronicos.com';
  return `${appUrl.replace(/\/$/, '')}/client/quotes/${quoteId}`;
}
