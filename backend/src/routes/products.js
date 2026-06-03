import { productRepository } from '../repositories/productRepository.js';
import { providerRepository } from '../repositories/providerRepository.js';
import { importProductsFromXlsx } from '../services/productImportService.js';
import { fetchAutomationDirectProduct, mapAutomationDirectProduct } from '../services/automationDirectService.js';
import { deleted, notFound } from '../utils/http.js';

export async function productRoutes(app) {
  app.get('/api/products', async (request) => productRepository.listPaginated(request.query || {}));
  app.get('/api/products/providers', async () => productRepository.getProviders());
  app.get('/api/products/categories', async (request) => productRepository.getCategoriesBySupplier(request.query?.supplier));

  app.post('/api/products', async (request, reply) => {
    const product = await productRepository.create(request.body);
    return reply.code(201).send(product);
  });

  app.get('/api/products/:id', async (request, reply) => {
    const product = await productRepository.findById(request.params.id);
    return product || notFound(reply, 'Product');
  });

  app.put('/api/products/:id', async (request, reply) => {
    const product = await productRepository.update(request.params.id, request.body);
    return product || notFound(reply, 'Product');
  });

  app.delete('/api/products/:id', async (request, reply) => {
    await productRepository.remove(request.params.id);
    return deleted(reply);
  });


  app.post('/api/products/:id/refresh-automationdirect', async (request, reply) => {
    const product = await productRepository.findById(request.params.id);
    if (!product) return notFound(reply, 'Product');

    const apiProduct = await fetchAutomationDirectProduct(product.partNumber);
    if (!apiProduct) {
      const updated = await productRepository.update(product.id, {
        lastAvailabilityCheckAt: new Date(),
        availabilityStatus: 'not_found',
        availabilityNote: 'Part number not found in AutomationDirect API'
      });
      return { product: updated, automationDirect: null };
    }

    const mapped = mapAutomationDirectProduct(apiProduct);
    const updated = await productRepository.update(product.id, {
      description: mapped.description || product.description,
      brand: mapped.brand || product.brand,
      category: mapped.category || product.category,
      unitCost: mapped.unitCost || product.unitCost,
      currency: mapped.currency || product.currency,
      availabilityStatus: mapped.availabilityStatus,
      availabilityNote: mapped.availabilityNote,
      leadTime: mapped.leadTime,
      automationDirectStatus: mapped.status,
      weight: mapped.weight,
      lastAvailabilityCheckAt: mapped.lastAvailabilityCheckAt,
      notes: mapped.availabilityNote ? `Availability: ${mapped.availabilityNote}` : product.notes
    });

    return { product: updated, automationDirect: apiProduct };
  });

  app.post('/api/products/import-xlsx', async (request) => {
    const file = await request.file();
    if (!file) return { created: 0, updated: 0, skipped: 0, errors: [{ row: 0, errors: ['Missing file'] }] };
    const buffer = await file.toBuffer();
    return importProductsFromXlsx(buffer);
  });

  app.post('/api/products/backfill-provider', async (request, reply) => {
    const providerId = request.body?.providerId;
    const supplierName = request.body?.supplierName;
    const provider = await providerRepository.findById(providerId);
    if (!provider) return notFound(reply, 'Provider');
    return productRepository.assignProviderBySupplier(providerId, supplierName || provider.companyName);
  });
}
