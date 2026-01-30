/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				agent: {
					system: '#6b7280',
					architect: '#8b5cf6',
					ui: '#ec4899',
					backend: '#10b981',
					devops: '#f59e0b',
					dashboard: '#3b82f6'
				}
			}
		}
	},
	plugins: []
};
