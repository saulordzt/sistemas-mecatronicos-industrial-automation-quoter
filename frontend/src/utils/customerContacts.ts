import type { Customer, CustomerContact } from '../types';

function normalizeString(value: unknown) {
  return String(value || '').trim();
}

export function normalizeCustomer(customer?: Partial<Customer> | null): Customer {
  const contacts = Array.isArray(customer?.contacts) ? customer?.contacts : [];
  const normalizedContacts = contacts
    .map((contact, index) => ({
      id: contact?.id || `${customer?.id || 'customer'}-contact-${index + 1}`,
      name: normalizeString(contact?.name || (contact as any)?.contactName),
      email: normalizeString(contact?.email).toLowerCase(),
      phone: normalizeString(contact?.phone),
      title: normalizeString(contact?.title),
      notes: normalizeString(contact?.notes),
      isPrimary: Boolean(contact?.isPrimary)
    }))
    .filter((contact) => contact.name || contact.email || contact.phone || contact.title || contact.notes);

  if (!normalizedContacts.length && ((customer as any)?.contactName || customer?.email || customer?.phone)) {
    normalizedContacts.push({
      id: customer?.primaryContactId || `${customer?.id || 'customer'}-legacy-primary`,
      name: normalizeString((customer as any)?.contactName),
      email: normalizeString(customer?.email).toLowerCase(),
      phone: normalizeString(customer?.phone),
      title: '',
      notes: '',
      isPrimary: true
    });
  }

  const primaryContact =
    normalizedContacts.find((contact) => contact.id === customer?.primaryContactId) ||
    normalizedContacts.find((contact) => contact.isPrimary) ||
    normalizedContacts[0] ||
    null;

  const finalContacts = normalizedContacts.map((contact) => ({
    ...contact,
    isPrimary: Boolean(primaryContact && contact.id === primaryContact.id)
  }));

  const resolvedPrimary = finalContacts.find((contact) => contact.isPrimary) || null;

  return {
    id: customer?.id,
    companyName: normalizeString(customer?.companyName),
    contacts: finalContacts,
    primaryContactId: resolvedPrimary?.id || null,
    primaryContact: resolvedPrimary,
    contactName: resolvedPrimary?.name || '',
    email: resolvedPrimary?.email || '',
    phone: resolvedPrimary?.phone || '',
    address: normalizeString(customer?.address),
    taxId: normalizeString(customer?.taxId),
    notes: normalizeString(customer?.notes)
  };
}

export function emptyCustomerContact(): CustomerContact {
  return {
    id: crypto.randomUUID(),
    name: '',
    email: '',
    phone: '',
    title: '',
    notes: '',
    isPrimary: false
  };
}

export function getPrimaryContact(customer?: Partial<Customer> | null) {
  return normalizeCustomer(customer).primaryContact || null;
}

export function getContactById(customer: Partial<Customer> | null | undefined, contactId?: string | null) {
  const normalizedCustomer = normalizeCustomer(customer);
  if (!contactId) return normalizedCustomer.primaryContact || null;
  return normalizedCustomer.contacts.find((contact) => contact.id === contactId) || normalizedCustomer.primaryContact || null;
}
