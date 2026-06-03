import { createRepository } from './baseRepository.js';
import { normalizeCustomer } from '../utils/customerContacts.js';

const base = createRepository('customers');

export const customerRepository = {
  ...base,
  async list() {
    const customers = await base.list();
    return customers.map(normalizeCustomer);
  },
  async findById(id) {
    const customer = await base.findById(id);
    return customer ? normalizeCustomer(customer) : null;
  },
  async create(data) {
    const customer = await base.create(normalizeCustomer(data));
    return normalizeCustomer(customer);
  },
  async update(id, data) {
    const customer = await base.update(id, normalizeCustomer(data));
    return customer ? normalizeCustomer(customer) : null;
  }
};
