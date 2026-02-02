<script lang="ts">
	import LeaderboardHeader from '$lib/components/leaderboard/LeaderboardHeader.svelte';
	import LeaderboardHighlights from '$lib/components/leaderboard/LeaderboardHighlights.svelte';
	import LeaderboardTable from '$lib/components/leaderboard/LeaderboardTable.svelte';
	import ClanDialog from '$lib/components/leaderboard/ClanDialog.svelte';
	import type { ClanLeaderboardEntry, ClanLeaderboardResponse } from '$lib/types/openfront';
	import { SvelteSet } from 'svelte/reactivity';

	const numberFormatter = new Intl.NumberFormat('en-US');

	let { data } = $props<{ data: { leaderboard: ClanLeaderboardResponse | null } | null }>();
	let leaderboard = $state<ClanLeaderboardResponse | null>(null);
	let isLoading = $state(false);
	let errorMessage = $state('');
	let lastUpdated = $state<Date | null>(null);

	let search = $state('');
	const searchSuggestionLimit = 12;

	let dialogOpen = $state(false);
	let activeClanTag = $state<string | null>(null);
	type ClanSession = Record<string, unknown>;
	let clanSessions = $state<ClanSession[]>([]);
	let clanLoading = $state(false);
	let clanError = $state('');
	let sessionsLoading = $state(false);
	let sessionsError = $state('');

	const formatNumber = (value: number | null | undefined) =>
		value === null || value === undefined ? '—' : numberFormatter.format(value);

	const formatRatio = (value: number | null | undefined) => {
		if (value === null || value === undefined || Number.isNaN(value)) return '—';
		return value.toFixed(2);
	};

	const formatPercent = (value: number) => `${value.toFixed(1)}%`;

	const getWinRate = (entry: ClanLeaderboardEntry) => {
		const total = entry.wins + entry.losses;
		if (total <= 0) return 0;
		return (entry.wins / total) * 100;
	};

	const getSessionKey = (session: ClanSession) => {
		const candidate =
			session.gameId ??
			session.game ??
			session.id ??
			session.sessionId ??
			session.matchId ??
			session.start;
		if (candidate !== undefined && candidate !== null) return String(candidate);
		return JSON.stringify(session);
	};

	const refreshLeaderboard = async () => {
		isLoading = true;
		errorMessage = '';

		try {
			const response = await fetch('/api/clans/leaderboard');
			if (!response.ok) {
				throw new Error(`Unexpected status ${response.status}`);
			}
			const json = (await response.json()) as ClanLeaderboardResponse;
			leaderboard = json;
			lastUpdated = new Date();
		} catch (err) {
			console.error('Failed to load leaderboard', err);
			errorMessage = 'Unable to load the clan leaderboard right now.';
		} finally {
			isLoading = false;
		}
	};

	const resetSessionsState = () => {
		clanSessions = [];
		sessionsError = '';
	};

	const loadSessions = async () => {
		if (sessionsLoading || !activeClanTag) return;
		sessionsLoading = true;
		sessionsError = '';

		try {
			const response = await fetch(`/api/clans/${activeClanTag}/sessions`);
			if (!response.ok) {
				throw new Error(`Sessions request failed ${response.status}`);
			}
			const json = (await response.json()) as unknown;
			const nextSessions = Array.isArray(json)
				? (json as ClanSession[])
				: Array.isArray((json as { sessions?: unknown }).sessions)
					? ((json as { sessions: ClanSession[] }).sessions ?? [])
					: [];

			const existingKeys = new SvelteSet(clanSessions.map(getSessionKey));
			const deduped = nextSessions.filter((session) => !existingKeys.has(getSessionKey(session)));
			clanSessions = deduped.length > 0 ? [...clanSessions, ...deduped] : clanSessions;
		} catch (err) {
			console.error('Failed to load clan sessions', err);
			sessionsError = 'Unable to load recent games.';
		} finally {
			sessionsLoading = false;
		}
	};

	const openClanDialog = async (clanTag: string) => {
		activeClanTag = clanTag;
		dialogOpen = true;
		clanError = '';
		clanLoading = true;
		resetSessionsState();
		void loadSessions();

		try {
			const statsRes = await fetch(`/api/clans/${clanTag}`);

			if (!statsRes.ok) {
				throw new Error(`Stats request failed ${statsRes.status}`);
			}

			await statsRes.json();
		} catch (err) {
			console.error('Failed to load clan detail', err);
			clanError = 'Unable to load clan details.';
		} finally {
			clanLoading = false;
		}
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
		if (leaderboard || data?.leaderboard) return;
		void refreshLeaderboard();
	});

	const rankImages = ['/images/rank-1.png', '/images/rank-2.png', '/images/rank-3.png'];
	const rankAccentColors = ['211 158 34', '127 141 154', '167 95 32'];

	const tableData = $derived.by(() => (leaderboard ? leaderboard.clans : []));
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
			{search}
			{rankLookup}
			{rankImages}
			{rankAccentColors}
			{formatNumber}
			{formatRatio}
			{formatPercent}
			{getWinRate}
			{openClanDialog}
		/>
	</div>
</div>

<ClanDialog
	bind:dialogOpen
	{clanLoading}
	{clanError}
	{sessionsError}
	{sessionsLoading}
	{clanSessions}
	{getSessionKey}
/>
