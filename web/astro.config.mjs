import { defineConfig } from 'astro/config';

// Integrations
import svelte from '@astrojs/svelte';
import partytown from '@astrojs/partytown';
import sitemap from '@astrojs/sitemap';
import { printSummary } from './src/utils/logger.ts';
import { fetchLastmod } from './src/utils/fetch-lastmod.ts';

// Deploy target (vercel | netlify | cloudflare | node). Default: vercel.
const env = { ...import.meta.env, ...process.env };
const deployTarget = env.DEPLOY_TARGET || 'vercel';

// The site is SSG by default; pages that need an adapter opt in via
// `export const prerender = false`. `OUTPUT` can override (e.g. `server`).
const output = env.OUTPUT || 'static';

// The FQDN of where the site is hosted (used for sitemaps & canonical URLs)
const site = env.SITE_URL || 'https://awesome-privacy.xyz';

// Only import the adapter we actually need — keeps optional peer deps
// (e.g. cloudflare → wrangler) out of the install on other targets.
const loadAdapter = async () => {
	switch (deployTarget) {
		case 'vercel':
			return (await import('@astrojs/vercel')).default();
		case 'netlify':
			return (await import('@astrojs/netlify')).default();
		case 'cloudflare':
			return (await import('@astrojs/cloudflare')).default();
		case 'node':
			return (await import('@astrojs/node')).default({ mode: 'standalone' });
		default:
			return undefined;
	}
};

const buildLogger = {
	name: 'build-logger',
	hooks: {
		'astro:build:done': () => printSummary(),
	},
};

// Get accurate lasmod date for each page from changelog, for sitemap
const lastmod = await fetchLastmod();

const serialize = (item) => {
	const changed = lastmod[new URL(item.url).pathname];
	return changed ? { ...item, lastmod: new Date(changed) } : item;
};

export default defineConfig({
	output,
	site,
	adapter: await loadAdapter(),
	integrations: [svelte(), partytown(), sitemap({ serialize }), buildLogger],
	vite: {
		css: {
			preprocessorOptions: {
				scss: { api: 'modern' },
			},
		},
	},
});
