import { defineStore } from 'pinia';

const storageKey = 'automation-quoter-settings';

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    company: {
      name: 'Sistemas Mecatronicos',
      legalName: 'Sistemas Mecatronicos',
      address: 'Company address',
      phone: '+1 000 000 0000',
      email: 'ventas@sistemasmecatronicos.com',
      website: 'sistemasmecatronicos.com',
      taxId: 'TAX-ID'
    }
  }),
  actions: {
    load() {
      const saved = localStorage.getItem(storageKey);
      if (saved) this.company = JSON.parse(saved);
    },
    save() {
      localStorage.setItem(storageKey, JSON.stringify(this.company));
    }
  }
});
