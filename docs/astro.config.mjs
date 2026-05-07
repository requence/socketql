// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
	vite: {
		plugins: [tailwindcss()],
	},
	integrations: [
		react(),
		starlight({
			title: 'SocketQL',
			logo: {
				src: './public/requence-wordmark.svg',
				replacesTitle: false,
			},
			favicon: '/logo.svg',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/requence/socketql' }],
			expressiveCode: {
				themes: ['dark-plus'],
				styleOverrides: {
					borderColor: 'var(--color-zinc-700)',
					borderRadius: '0.375rem',
					codeBackground: '#09090b',
				},
			},
			customCss: ['./src/styles/custom.css'],
			components: {
				PageFrame: './src/components/overrides/PageFrame.astro',
				ThemeSelect: './src/components/overrides/ThemeSelect.astro',
			},
			sidebar: [
				{
					label: 'Concepts',
					items: [
						{ label: 'Introduction', slug: 'concepts/01-introduction' },
						{ label: 'Server', slug: 'concepts/02-server' },
						{ label: 'Client', slug: 'concepts/03-client' },
						{ label: 'React Hooks', slug: 'concepts/04-react-hooks' },
						{ label: 'Live Queries', slug: 'concepts/05-live-queries' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'createServer', slug: 'reference/01-create-server' },
						{ label: 'createClient', slug: 'reference/02-create-client' },
						{ label: 'React Hooks', slug: 'reference/03-react-hooks' },
					],
				},
			],
		}),
	],
});
