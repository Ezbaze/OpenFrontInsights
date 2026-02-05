<script lang="ts">
	import LeaderboardHeader from '$lib/components/leaderboard/LeaderboardHeader.svelte';
	import LeaderboardHighlights from '$lib/components/leaderboard/LeaderboardHighlights.svelte';
	import LeaderboardCharts from '$lib/components/leaderboard/LeaderboardCharts.svelte';
	import LeaderboardTable from '$lib/components/leaderboard/LeaderboardTable.svelte';
	import {
		displayNumber,
		displayPercent,
		displayRatio,
		getLeaderboardWinRatePercent
	} from '$lib/leaderboard/metrics';
	import type { ClanLeaderboardResponse } from '$lib/types/openfront';
	import { SvelteSet } from 'svelte/reactivity';
	import { browser } from '$app/environment';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';

	let { data } = $props<{ data: { leaderboard: ClanLeaderboardResponse | null } | null }>();
	let leaderboard = $state<ClanLeaderboardResponse | null>(null);
	let isLoading = $state(false);
	let errorMessage = $state('');
	let lastUpdated = $state<Date | null>(null);

	let search = $state('');
	const searchSuggestionLimit = 12;
	let focusedClanTag = $state<string | null>(null);

	const formatNumber = displayNumber;
	const formatRatio = displayRatio;
	const formatPercent = displayPercent;
	const getWinRate = getLeaderboardWinRatePercent;

	const refreshLeaderboard = async () => {
		isLoading = true;
		errorMessage = '';

		try {
			await invalidateAll();
			lastUpdated = new Date();
		} catch (err) {
			console.error('Failed to refresh leaderboard', err);
			errorMessage = 'Unable to load the clan leaderboard right now.';
		} finally {
			isLoading = false;
		}
	};

	const openClanDialog = (clanTag: string) => {
		const tag = String(clanTag ?? '').trim();
		if (!tag) return;
		void goto(resolve(`/clans/${encodeURIComponent(tag.toUpperCase())}`));
	};
	const handleClanFocus = async (clanTag: string) => {
		const tag = String(clanTag ?? '').trim();
		if (!tag) return;
		focusedClanTag = null;
		await tick();
		focusedClanTag = tag;
	};

	const renderDateRange = () => {
		if (!leaderboard) return '—';
		const start = new Date(leaderboard.start).toLocaleDateString();
		const end = new Date(leaderboard.end).toLocaleDateString();
		return `${start} → ${end}`;
	};

	const renderLastUpdated = () => {
		if (!lastUpdated) return 'Not refreshed yet';
		return lastUpdated.toLocaleTimeString();
	};

	$effect(() => {
		if (!leaderboard && data?.leaderboard) {
			leaderboard = data.leaderboard as ClanLeaderboardResponse;
			lastUpdated = lastUpdated ?? new Date();
		}
	});

	$effect(() => {
		if (!browser) return;
		if (leaderboard || data?.leaderboard) return;
		void refreshLeaderboard();
	});

	const rankImages = ['/images/rank-1.png', '/images/rank-2.png', '/images/rank-3.png'];
	const rankAccentColors = ['211 158 34', '127 141 154', '167 95 32'];

	const tableData = $derived.by(
		() => (leaderboard?.clans ?? []) as ClanLeaderboardResponse['clans']
	);
	const searchSuggestions = $derived.by(() => {
		const target = String(search ?? '')
			.trim()
			.toLowerCase();
		const seen = new SvelteSet<string>();
		const suggestions: string[] = [];
		for (const entry of tableData) {
			const tag = String(entry.clanTag ?? '').trim();
			if (!tag || seen.has(tag)) continue;
			if (target && !tag.toLowerCase().includes(target)) continue;
			seen.add(tag);
			suggestions.push(tag);
			if (suggestions.length >= searchSuggestionLimit) break;
		}
		return suggestions;
	});
	const rankLookup = $derived.by(
		() => new Map(tableData.map((entry, index) => [String(entry.clanTag ?? ''), index + 1]))
	);
	const topEntries = $derived.by(() => tableData.slice(0, 3));
</script>

<div class="min-h-screen bg-background">
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-4 p-8">
		<LeaderboardHeader
			bind:search
			{searchSuggestions}
			{renderDateRange}
			{renderLastUpdated}
			onRefresh={refreshLeaderboard}
		/>

		<LeaderboardHighlights
			{isLoading}
			{topEntries}
			{rankImages}
			{rankAccentColors}
			{formatNumber}
			{formatRatio}
			{formatPercent}
			{getWinRate}
		/>

		<LeaderboardTable
			{isLoading}
			{errorMessage}
			entries={tableData}
			focusClanTag={focusedClanTag}
			{rankLookup}
			{rankImages}
			{rankAccentColors}
			{formatNumber}
			{formatRatio}
			{formatPercent}
			{getWinRate}
			{openClanDialog}
		/>

		<LeaderboardCharts entries={tableData} onClanFocus={handleClanFocus} />
	</div>
</div>
