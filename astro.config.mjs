import { defineConfig } from 'astro/config';
import icon from 'astro-icon';

export default defineConfig({
  site: 'https://rusinternet.com',
  output: 'static',
  trailingSlash: 'always',
  integrations: [icon()],
  build: {
    format: 'directory',
    inlineStylesheets: 'never'
  }
});
