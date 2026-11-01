import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://yexuan.qzz.io',
  markdown: {
    shikiConfig: {
      // 双主题：CSS 里用 --shiki-light / --shiki-dark 切换，见 global.css
      themes: {
        light: 'github-light',
        dark: 'github-dark-dimmed',
      },
      wrap: true,
    },
  },
});
