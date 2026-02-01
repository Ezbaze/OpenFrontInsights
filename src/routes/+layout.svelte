<script lang="ts">
	import './layout.css';
	import { ModeWatcher } from 'mode-watcher';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href="/favicon.png" type="image/png" /></svelte:head>
<ModeWatcher defaultMode="dark" />
{@render children()}
