<script lang="ts">
	import './layout.css';
	import { dev } from '$app/environment';
	import { ModeWatcher } from 'mode-watcher';
	import { env } from '$env/dynamic/public';

	let { children } = $props();
	const siteUrl = dev
		? typeof window !== 'undefined'
			? window.location.origin
			: 'http://localhost:5173'
		: env.PUBLIC_SITE_URL ?? '';
</script>

<svelte:head>
	<link rel="icon" href="/favicon.png" type="image/png" />
	<title>OpenFrontInsights</title>
	<meta
		name="description"
		content="OpenFrontInsights — a leaderboard and stats hub for OpenFront."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:title" content="OpenFrontInsights" />
	<meta
		property="og:description"
		content="OpenFrontInsights — a leaderboard and stats hub for OpenFront."
	/>
	<meta property="og:image" content={`${siteUrl}/images/og-image.png`} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="OpenFrontInsights" />
	<meta
		name="twitter:description"
		content="OpenFrontInsights — a leaderboard and stats hub for OpenFront."
	/>
	<meta name="twitter:image" content={`${siteUrl}/images/og-image.png`} />
</svelte:head>
<ModeWatcher defaultMode="dark" />
{@render children()}
