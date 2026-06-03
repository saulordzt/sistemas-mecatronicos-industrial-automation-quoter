function normalizeString(value) {
  return String(value || '').trim();
}

export function normalizeCustomer(customer = {}) {
  const contacts = Array.isArray(customer.contacts) ? customer.contacts : [];
  const normalizedContacts = contacts
    .map((contact, index) => ({
      id: contact?.id || `${customer.id || 'customer'}-contact-${index + 1}`,
      name: normalizeString(contact?.name || contact?.contactName),
      email: normalizeString(contact?.email).toLowerCase(),
      phone: normalizeString(contact?.phone),
      title: normalizeString(contact?.title),
      notes: normalizeString(contact?.notes),
      isPrimary: Boolean(contact?.isPrimary)
    }))
    .filter((contact) => contact.name || contact.email || contact.phone || contact.title || contact.notes);

  if (!normalizedContacts.length && (customer.contactName || customer.email || customer.phone)) {
    normalizedContacts.push({
      id: customer.primaryContactId || `${customer.id || 'customer'}-legacy-primary`,
      name: normalizeString(customer.contactName),
      email: normalizeString(customer.email).toLowerCase(),
      phone: normalizeString(customer.phone),
      title: '',
      notes: '',
      isPrimary: true
    });
  }

  const requestedPrimaryId = normalizeString(customer.primaryContactId);
  let primaryContact =
    normalizedContacts.find((contact) => requestedPrimaryId && contact.id === requestedPrimaryId) ||
    normalizedContacts.find((contact) => contact.isPrimary) ||
    normalizedContacts[0] ||
    null;

  const finalContacts = normalizedContacts.map((contact) => ({
    ...contact,
    isPrimary: Boolean(primaryContact && contact.id === primaryContact.id)
  }));

  primaryContact = finalContacts.find((contact) => contact.isPrimary) || null;

  return {
    ...customer,
    contacts: finalContacts,
    primaryContactId: primaryContact?.id || null,
    primaryContact,
    contactName: primaryContact?.name || '',
    email: primaryContact?.email || '',
    phone: primaryContact?.phone || ''
  };
}

export function getCustomerContact(customer, contactId) {
  const normalizedCustomer = normalizeCustomer(customer);
  if (!contactId) return normalizedCustomer.primaryContact || null;
  return normalizedCustomer.contacts.find((contact) => contact.id === contactId) || null;
}
