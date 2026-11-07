import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    // All prepared Markdown is publishable, including names beginning with _.
    // Keep Chinese characters, capitals and punctuation in the original URL.
    loader: glob({
      base: './src/content/docs', pattern: '**/*.md',
      generateId: ({ entry }) => entry.replace(/\.md$/i, ''),
    }),
    schema: docsSchema(),
  }),
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
