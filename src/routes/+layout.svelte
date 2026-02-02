<script lang="ts">
	import './layout.css';
	import { ModeWatcher } from 'mode-watcher';
	import { PUBLIC_SITE_URL } from '$env/static/public';

	let { children } = $props();
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
	<meta
		property="og:image"
		content={`${PUBLIC_SITE_URL}/images/og-image.png`}
	/>
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="OpenFrontInsights" />
	<meta
		name="twitter:description"
		content="OpenFrontInsights — a leaderboard and stats hub for OpenFront."
	/>
	<meta
		name="twitter:image"
		content={`${PUBLIC_SITE_URL}/images/og-image.png`}
	/>
</svelte:head>
<ModeWatcher defaultMode="dark" />
{@render children()}
