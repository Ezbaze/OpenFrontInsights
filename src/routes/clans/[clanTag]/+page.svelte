<script lang="ts">
	import LeaderboardHeader from '$lib/components/leaderboard/LeaderboardHeader.svelte';
	import ClanCharts from '$lib/components/leaderboard/ClanCharts.svelte';
	import ClanSessionsTable from '$lib/components/leaderboard/ClanSessionsTable.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import * as Card from '$lib/components/ui/card';
	import * as Empty from '$lib/components/ui/empty';
	import { Badge } from '$lib/components/ui/badge';
	import { Toaster } from '$lib/components/ui/sonner';
	import * as Table from '$lib/components/ui/table';
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
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

	let clanSessions = $state<ClanSession[]>(data.clanSessions ?? []);
	let sessionsLoading = $state(true);
	let sessionsComplete = $state(false);
	let sessionsError = $state(data.errors.sessions ?? '');
	let sessionsLoadedChunks = $state(0);
	let sessionsNotifiedComplete = $state(false);

	let activeSessionsLoadId = 0;
	let activeSessionsAbort: AbortController | null = null;

	const SESSION_CHUNK_DAYS = 7;
	const SESSION_CHUNK_MS = SESSION_CHUNK_DAYS * 24 * 60 * 60 * 1000;
	const SESSION_MAX_CHUNKS = 260;

	const numberFormatter = new Intl.NumberFormat('en-US');
	let search = $state('');
	const searchSuggestionLimit = 12;

	const extractSessions = (payload: unknown): ClanSession[] => {
		if (Array.isArray(payload)) return payload as ClanSession[];
		if (
			payload &&
			typeof payload === 'object' &&
			Array.isArray((payload as { sessions?: unknown }).sessions)
		) {
			return ((payload as { sessions: ClanSession[] }).sessions ?? []) as ClanSession[];
		}
		return [];
	};

	const getSessionKey = (session: ClanSession) => {
		const candidate =
			session.gameId ??
			session.game ??
			session.id ??
			session.sessionId ??
			session.matchId ??
			session.gameStart;
		if (candidate !== undefined && candidate !== null && candidate !== '') return String(candidate);
		return JSON.stringify(session);
	};

	const fetchSessionChunk = async (
		clanTag: string,
		start: Date,
		end: Date,
		signal: AbortSignal
	) => {
		const params = new URLSearchParams({
			start: start.toISOString(),
			end: end.toISOString()
		});
		const response = await fetch(
			`/api/clans/${encodeURIComponent(clanTag)}/sessions?${params.toString()}`,
			{ signal }
		);
		if (!response.ok) {
			throw new Error(`Clan sessions request failed ${response.status}`);
		}
		const json = (await response.json()) as unknown;
		return extractSessions(json);
	};

	const loadAllSessions = async (clanTag: string) => {
		if (!clanTag) return;

		activeSessionsLoadId += 1;
		const loadId = activeSessionsLoadId;

		activeSessionsAbort?.abort();
		const controller = new AbortController();
		activeSessionsAbort = controller;

		sessionsLoading = true;
		sessionsComplete = false;
		sessionsError = '';
		clanSessions = [];
		sessionsLoadedChunks = 0;
		sessionsNotifiedComplete = false;

		const seen = new Set<string>();
		const results: ClanSession[] = [];

		try {
			let cursorEnd = new Date();
			let chunkCount = 0;
			while (chunkCount < SESSION_MAX_CHUNKS) {
				if (controller.signal.aborted || loadId !== activeSessionsLoadId) return;
				const end = new Date(cursorEnd);
				const start = new Date(end.getTime() - SESSION_CHUNK_MS);
				const chunk = await fetchSessionChunk(clanTag, start, end, controller.signal);
				chunkCount += 1;
				sessionsLoadedChunks = chunkCount;
				if (chunk.length === 0) break;
				for (const session of chunk) {
					const key = getSessionKey(session);
					if (seen.has(key)) continue;
					seen.add(key);
					results.push(session);
				}
				clanSessions = [...results];
				cursorEnd = start;
			}
			if (loadId !== activeSessionsLoadId) return;
			if (chunkCount >= SESSION_MAX_CHUNKS) {
				sessionsError =
					'Reached lookback limit while loading sessions. Showing the most recent data found.';
			}
			sessionsComplete = true;
		} catch (err) {
			if (controller.signal.aborted || loadId !== activeSessionsLoadId) return;
			console.error(`Failed to load clan sessions for ${clanTag}`, err);
			sessionsError =
				results.length > 0
					? 'Unable to load older sessions. Showing partial session data.'
					: 'Unable to load clan sessions.';
			sessionsComplete = results.length > 0;
		} finally {
			if (loadId === activeSessionsLoadId) {
				sessionsLoading = false;
			}
		}
	};

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

	const hasSessionData = $derived.by(() => clanSessions.length > 0);
	const showSessionLoadingCard = $derived.by(() => sessionsLoading && !hasSessionData);
	const showPartialSessionsWarning = $derived.by(() => Boolean(sessionsError) && hasSessionData);

	const sessionsProgressLabel = $derived.by(() => {
		if (!sessionsLoading) return '';
		return `${sessionsLoadedChunks} chunk${sessionsLoadedChunks === 1 ? '' : 's'} fetched`;
	});

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

	$effect(() => {
		if (!browser) return;
		const clanTag = data.clanTag;
		const reloadToken = data.loadedAt;
		void reloadToken;
		void loadAllSessions(clanTag);
	});

	$effect(() => {
		if (!browser) return;
		if (
			sessionsComplete &&
			!sessionsLoading &&
			!sessionsError &&
			!sessionsNotifiedComplete
		) {
			toast.success('Clan sessions loaded.');
			sessionsNotifiedComplete = true;
		}
	});
</script>

<div class="min-h-screen bg-background">
	<Toaster position="top-right" />
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
			clanSessions={clanSessions}
			sessionsLoading={sessionsLoading}
			sessionsComplete={sessionsComplete}
			sessionsError={hasSessionData ? '' : sessionsError}
			hideSessions={showSessionLoadingCard}
			onSessionFocus={handleSessionFocus}
		/>

		{#if showPartialSessionsWarning}
			<Alert.Root>
				<Alert.Title>Showing partial session data</Alert.Title>
				<Alert.Description>{sessionsError}</Alert.Description>
			</Alert.Root>
		{/if}

		{#if showSessionLoadingCard}
			<section class="flex flex-col gap-4">
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-xl">Loading session data</Card.Title>
						<Card.Description>
							Pulling recent clan sessions in weekly windows and stepping backward until no
							more sessions are returned.
						</Card.Description>
					</Card.Header>
					<Card.Content class="grid gap-3">
						<div class="text-sm text-muted-foreground">{sessionsProgressLabel}</div>
					</Card.Content>
				</Card.Root>
			</section>
		{:else}
			<section class="flex flex-col gap-4">
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-xl">Recent games</Card.Title>
						<Card.Description>Latest public sessions for this clan.</Card.Description>
					</Card.Header>
					<Card.Content>
						<ClanSessionsTable
							clanSessions={clanSessions}
							sessionsLoading={sessionsLoading}
							sessionsError={hasSessionData ? '' : sessionsError}
							heightClass="h-[70vh]"
							focusSessionKey={focusedSessionKey}
						/>
					</Card.Content>
				</Card.Root>
			</section>
		{/if}
	</div>
</div>
