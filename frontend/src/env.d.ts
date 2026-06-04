declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module '*.png';
declare module 'virtual:pwa-register' {
  export function registerSW(options?: Record<string, unknown>): (reloadPage?: boolean) => Promise<void>;
}
