import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from '../pages/Dashboard.vue';
import Customers from '../pages/Customers.vue';
import CustomerView from '../pages/CustomerView.vue';
import CustomerForm from '../pages/CustomerForm.vue';
import Projects from '../pages/Projects.vue';
import ProjectForm from '../pages/ProjectForm.vue';
import Quotes from '../pages/Quotes.vue';
import QuoteForm from '../pages/QuoteForm.vue';
import GuidedQuoteAssistant from '../pages/GuidedQuoteAssistant.vue';
import ServiceRates from '../pages/ServiceRates.vue';
import Settings from '../pages/Settings.vue';
import Login from '../pages/Login.vue';
import Products from '../pages/Products.vue';
import PublicQuoteView from '../pages/PublicQuoteView.vue';
import { useAuthStore } from '../stores/authStore';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: Login, meta: { public: true } },
    { path: '/client/quotes/:id', component: PublicQuoteView, meta: { public: true } },
    { path: '/', component: Dashboard },
    { path: '/customers', component: Customers },
    { path: '/customers/new', component: CustomerForm },
    { path: '/customers/:id', component: CustomerView },
    { path: '/customers/:id/edit', component: CustomerForm },
    { path: '/projects', component: Projects },
    { path: '/projects/new', component: ProjectForm },
    { path: '/projects/:id/edit', component: ProjectForm },
    { path: '/quotes', component: Quotes },
    { path: '/quotes/new', component: QuoteForm },
    { path: '/quotes/:id/edit', component: QuoteForm },
    { path: '/quote-assistant', component: GuidedQuoteAssistant },
    { path: '/products', component: Products },
    { path: '/service-rates', component: ServiceRates },
    { path: '/settings', component: Settings }
  ]
});

export default router;


router.beforeEach((to) => {
  const auth = useAuthStore();
  auth.hydrate();
  if (to.meta.public) return true;
  if (!auth.isAuthenticated) return { path: '/login', query: { redirect: to.fullPath } };
  return true;
});
