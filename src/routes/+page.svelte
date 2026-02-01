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

<style>
	:global(.sessions-scroll [data-slot='table-container']) {
		overflow: visible;
	}

	:global(.sessions-scroll [data-slot='scroll-area-viewport']) {
		scrollbar-gutter: stable both-edges;
	}

	:global(.sessions-table) {
		table-layout: fixed;
		min-width: 100%;
	}

	:global(.rank-accent) {
		--rank-accent-erase: hsl(var(--card));
		--rank-accent-shadow: rgba(15, 23, 42, 0.18);
		filter: saturate(1.05) drop-shadow(0 10px 16px var(--rank-accent-shadow));
		background: var(--rank-accent-erase);
		border-radius: 9999px;
		box-shadow: 0 0 0 6px var(--rank-accent-erase);
		object-fit: cover;
		transform: scale(1.25);
		transform-origin: center;
		opacity: 1;
	}

	:global(.dark .rank-accent) {
		--rank-accent-shadow: rgba(0, 0, 0, 0.55);
	}

	:global(.rank-icon) {
		object-fit: cover;
		transform: scale(1.35);
		transform-origin: center;
		opacity: 1;
	}

	:global(.rank-card) {
		box-shadow:
			inset 0 3px 0 rgb(var(--rank-accent) / 1),
			0 1px 2px rgba(15, 23, 42, 0.08);
		border-color: rgb(var(--rank-accent) / 0.22);
	}

	:global(.rank-card-glow) {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: radial-gradient(
			140px 80px at 12% 6%,
			rgb(var(--rank-accent) / 0.16),
			transparent 65%
		);
		pointer-events: none;
		opacity: 0.9;
	}

	:global(.rank-row) {
		background: linear-gradient(
			90deg,
			rgb(var(--rank-accent) / 0.12) 0%,
			rgb(var(--rank-accent) / 0.05) 18%,
			transparent 55%
		);
		box-shadow: inset 3px 0 0 rgb(var(--rank-accent) / 0.9);
	}

	:global(.rank-badge) {
		background: rgb(var(--rank-accent) / 0.15);
		color: rgb(var(--rank-accent) / 1);
		border-color: rgb(var(--rank-accent) / 0.45);
	}

	:global(.rank-tag) {
		border-color: rgb(var(--rank-accent) / 0.45);
		color: rgb(var(--rank-accent) / 1);
	}

	:global(.rank-number) {
		color: rgb(var(--rank-accent) / 1);
	}

	:global(.search-suggestions) {
		scrollbar-width: none;
	}

	:global(.search-suggestions::-webkit-scrollbar) {
		display: none;
	}

	:global(.leaderboard-header) {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background-color: hsl(var(--background));
		aspect-ratio: 1536 / 436;
		min-height: 14rem;
	}

	:global(.leaderboard-header-content) {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.75rem 0;
	}

	:global(.leaderboard-header-accent) {
		position: absolute;
		inset: 0;
		z-index: 1;
		pointer-events: none;
		background-image: url('/images/ambient_header.png');
		background-repeat: no-repeat;
		background-size: cover;
		background-position: right 40%;
		mask-image: linear-gradient(
			to bottom,
			rgba(0, 0, 0, 1) 0%,
			rgba(0, 0, 0, 1) 72%,
			rgba(0, 0, 0, 0) 100%
		);
	}

	:global(.leaderboard-header-accent::after) {
		content: '';
		position: absolute;
		inset: 0;
		background-image: url('/images/ambient_header.png');
		background-repeat: no-repeat;
		background-size: cover;
		background-position: right 40%;
		filter: blur(18px);
		opacity: 0.55;
		mask-image: linear-gradient(
			to bottom,
			rgba(0, 0, 0, 0) 0%,
			rgba(0, 0, 0, 0) 65%,
			rgba(0, 0, 0, 1) 100%
		);
		pointer-events: none;
	}

	@media (max-width: 1024px) {
		:global(.leaderboard-header-accent) {
			background-position: right 45%;
		}
	}

	@media (max-width: 640px) {
		:global(.leaderboard-header) {
			aspect-ratio: auto;
			min-height: 0;
		}

		:global(.leaderboard-header-content) {
			position: relative;
			padding: 0.85rem 0 1rem;
		}

		:global(.leaderboard-header-accent) {
			height: 6.5rem;
			background-position: right bottom;
			opacity: 0.5;
			mask-image: linear-gradient(
				to top,
				rgba(0, 0, 0, 1) 0%,
				rgba(0, 0, 0, 1) 55%,
				rgba(0, 0, 0, 0) 100%
			);
			top: auto;
			bottom: 0;
		}

		:global(.leaderboard-header-accent::after) {
			top: auto;
			bottom: 0;
			height: 7.5rem;
			background-position: right bottom;
			opacity: 0.35;
			mask-image: linear-gradient(to top, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 1) 70%);
		}
	}

	@media (max-width: 420px) {
		:global(.leaderboard-header-accent) {
			display: none;
		}
	}
</style>
