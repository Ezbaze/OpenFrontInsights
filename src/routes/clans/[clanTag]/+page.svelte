<script lang="ts">
	import LeaderboardHeader from '$lib/components/leaderboard/LeaderboardHeader.svelte';
	import ClanCharts from '$lib/components/leaderboard/ClanCharts.svelte';
	import ClanSessionsTable from '$lib/components/leaderboard/ClanSessionsTable.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import * as Card from '$lib/components/ui/card';
	import * as Empty from '$lib/components/ui/empty';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import { invalidateAll } from '$app/navigation';
	import { tick } from 'svelte';
	import type { ClanLeaderboardResponse, ClanSession, ClanStats } from '$lib/types/openfront';
	import { SvelteSet } from 'svelte/reactivity';

	let { data } = $props<{
		data: {
			clanTag: string;
			leaderboard: ClanLeaderboardResponse | null;
			clanStats: ClanStats | null;
			clanSessions: ClanSession[];
			errors: {
				leaderboard?: string;
				stats?: string;
				sessions?: string;
			};
			loadedAt: string;
		};
	}>();

	const numberFormatter = new Intl.NumberFormat('en-US');
	let search = $state('');
	const searchSuggestionLimit = 12;

	const formatNumber = (value: number | null | undefined) =>
		value === null || value === undefined ? '—' : numberFormatter.format(value);
	const formatRatio = (value: number | null | undefined) => {
		if (value === null || value === undefined || Number.isNaN(value)) return '—';
		return value.toFixed(2);
	};
	const formatPercent = (value: number) => `${value.toFixed(1)}%`;
	const getWinRate = (wins: number, losses: number) => {
		const total = wins + losses;
		if (total <= 0) return 0;
		return (wins / total) * 100;
	};

	const renderDateRange = () => {
		if (!data.leaderboard) return '—';
		const start = new Date(data.leaderboard.start).toLocaleDateString();
		const end = new Date(data.leaderboard.end).toLocaleDateString();
		return `${start} → ${end}`;
	};

	const renderLastUpdated = () => {
		const loadedAt = new Date(data.loadedAt);
		if (Number.isNaN(loadedAt.getTime())) return '—';
		return loadedAt.toLocaleTimeString();
	};

	const refreshPage = async () => {
		await invalidateAll();
	};

	const tableData = $derived.by(() => (data.leaderboard ? data.leaderboard.clans : []));
	const rankLookup = $derived.by(
		() =>
			new Map(
				tableData.map((entry, index) => [String(entry.clanTag ?? '').toUpperCase(), index + 1])
			)
	);
	const clanEntry = $derived.by(() =>
		tableData.find(
			(entry) => String(entry.clanTag ?? '').toUpperCase() === data.clanTag.toUpperCase()
		)
	);
	const clanRank = $derived.by(() => rankLookup.get(data.clanTag.toUpperCase()) ?? null);
	const rankImages = ['/images/rank-1.png', '/images/rank-2.png', '/images/rank-3.png'];
	const rankAccentColors = ['211 158 34', '127 141 154', '167 95 32'];
	const rankAccent = $derived.by(() =>
		clanRank && clanRank <= 3 ? rankAccentColors[clanRank - 1] : null
	);
	const summaryRows = $derived.by(() => {
		const leaderboard = clanEntry;
		const lifetime = data.clanStats;
		return [
			{
				label: 'Weighted wins',
				leaderboard: leaderboard ? formatNumber(leaderboard.weightedWins) : '—',
				lifetime: lifetime ? formatNumber(lifetime.weightedWins) : '—'
			},
			{
				label: 'Weighted losses',
				leaderboard: leaderboard ? formatNumber(leaderboard.weightedLosses) : '—',
				lifetime: lifetime ? formatNumber(lifetime.weightedLosses) : '—'
			},
			{
				label: 'Weighted W/L',
				leaderboard: leaderboard ? formatRatio(leaderboard.weightedWLRatio) : '—',
				lifetime: lifetime ? formatRatio(lifetime.weightedWLRatio) : '—'
			},
			{
				label: 'Games',
				leaderboard: leaderboard ? formatNumber(leaderboard.games) : '—',
				lifetime: lifetime ? formatNumber(lifetime.games) : '—'
			},
			{
				label: 'Wins',
				leaderboard: leaderboard ? formatNumber(leaderboard.wins) : '—',
				lifetime: lifetime ? formatNumber(lifetime.wins) : '—'
			},
			{
				label: 'Losses',
				leaderboard: leaderboard ? formatNumber(leaderboard.losses) : '—',
				lifetime: lifetime ? formatNumber(lifetime.losses) : '—'
			},
			{
				label: 'Win rate',
				leaderboard: leaderboard
					? formatPercent(getWinRate(leaderboard.wins, leaderboard.losses))
					: '—',
				lifetime: lifetime ? formatPercent(getWinRate(lifetime.wins, lifetime.losses)) : '—'
			},
			{
				label: 'Player sessions',
				leaderboard: leaderboard ? formatNumber(leaderboard.playerSessions) : '—',
				lifetime: '—'
			}
		];
	});
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

	let focusedSessionKey = $state<string | null>(null);
	const handleSessionFocus = async (sessionKey: string) => {
		focusedSessionKey = null;
		await tick();
		focusedSessionKey = sessionKey;
	};
</script>

<div class="min-h-screen bg-background">
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-4 p-8">
		<LeaderboardHeader
			bind:search
			{searchSuggestions}
			{renderDateRange}
			{renderLastUpdated}
			onRefresh={refreshPage}
		/>

		<section class="flex flex-col gap-4">
			<Card.Root
				class={rankAccent
					? 'relative overflow-visible border-[rgb(var(--rank-accent)/0.22)] shadow-[inset_0_3px_0_rgb(var(--rank-accent)/1),_0_1px_2px_rgba(15,23,42,0.08)]'
					: ''}
				style={rankAccent ? `--rank-accent: ${rankAccent}` : ''}
			>
				{#if rankAccent}
					<div
						class="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(140px_80px_at_12%_6%,_rgb(var(--rank-accent)/0.16),_transparent_65%)] opacity-90"
						aria-hidden="true"
					></div>
				{/if}
				{#if clanRank && clanRank <= 3 && rankImages[clanRank - 1]}
					<img
						src={rankImages[clanRank - 1]}
						alt={`Rank ${clanRank} accent`}
						class="pointer-events-none absolute top-0 left-1/2 h-14 w-14 origin-center -translate-x-1/2 -translate-y-1/2 scale-[1.25] object-cover opacity-100 drop-shadow-[0_10px_16px_rgba(15,23,42,0.18)] saturate-[1.05] dark:drop-shadow-[0_10px_16px_rgba(0,0,0,0.55)]"
						loading="lazy"
					/>
				{/if}
				<Card.Header class="gap-2">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div class="flex flex-wrap items-center gap-2">
							<h2 class="text-2xl font-semibold">Clan {data.clanTag.toUpperCase()}</h2>
							{#if clanRank}
								<Badge
									variant={clanRank === 1 ? 'default' : 'secondary'}
									style={rankAccent ? `--rank-accent: ${rankAccent}` : ''}
									class={rankAccent
										? 'border-[rgb(var(--rank-accent)/0.45)] bg-[rgb(var(--rank-accent)/0.15)] text-[rgb(var(--rank-accent)/1)]'
										: ''}
								>
									Rank #{clanRank}
								</Badge>
							{:else}
								<Badge variant="outline">Rank unavailable</Badge>
							{/if}
						</div>
					</div>
					{#if !clanEntry}
						<Card.Description>This clan is not in the current top 100.</Card.Description>
					{/if}
				</Card.Header>
				<Card.Content class="grid gap-4 text-sm">
					{#if !clanEntry && !data.clanStats}
						<Empty.Root class="border-muted-foreground/30">
							<h3 class="text-lg font-semibold">No clan stats</h3>
							<p class="text-sm text-muted-foreground">
								Clan totals are unavailable at the moment.
							</p>
						</Empty.Root>
					{:else}
						<Table.Root class="min-w-full table-fixed">
							<Table.Header class="bg-card">
								<Table.Row>
									<Table.Head class="w-1/3">Metric</Table.Head>
									<Table.Head class="text-right">Leaderboard window</Table.Head>
									<Table.Head class="text-right">Lifetime totals</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each summaryRows as row (row.label)}
									<Table.Row>
										<Table.Cell class="text-muted-foreground">{row.label}</Table.Cell>
										<Table.Cell class="text-right font-medium">{row.leaderboard}</Table.Cell>
										<Table.Cell class="text-right font-medium">{row.lifetime}</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					{/if}
				</Card.Content>
			</Card.Root>
		</section>

		{#if data.errors.stats}
			<Alert.Root variant="destructive">
				<Alert.Title>Clan stats unavailable</Alert.Title>
				<Alert.Description>{data.errors.stats}</Alert.Description>
			</Alert.Root>
		{/if}

		<ClanCharts
			clanTag={data.clanTag.toUpperCase()}
			clanStats={data.clanStats}
			clanSessions={data.clanSessions}
			sessionsLoading={false}
			onSessionFocus={handleSessionFocus}
		/>

		<section class="flex flex-col gap-4">
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-xl">Recent games</Card.Title>
					<Card.Description>Latest public sessions for this clan.</Card.Description>
				</Card.Header>
				<Card.Content>
					<ClanSessionsTable
						clanSessions={data.clanSessions}
						sessionsLoading={false}
						sessionsError={data.errors.sessions ?? ''}
						heightClass="h-[70vh]"
						focusSessionKey={focusedSessionKey}
					/>
				</Card.Content>
			</Card.Root>
		</section>
	</div>
</div>
