<script lang="ts">
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import LeaderboardHeader from '$lib/components/leaderboard/LeaderboardHeader.svelte';
	import DataTableSortHeader from '$lib/components/leaderboard/DataTableSortHeader.svelte';
	import PlayerCharts from '$lib/components/leaderboard/PlayerCharts.svelte';
	import PlayerIdentityCharts from '$lib/components/leaderboard/PlayerIdentityCharts.svelte';
	import PlayerSessionsTable from '$lib/components/leaderboard/PlayerSessionsTable.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as Empty from '$lib/components/ui/empty';
	import * as ScrollArea from '$lib/components/ui/scroll-area';
	import { Toaster } from '$lib/components/ui/sonner';
	import * as Table from '$lib/components/ui/table';
	import { addRecentlyViewed } from '$lib/leaderboard/recently-viewed';
	import { displayPercent } from '$lib/leaderboard/metrics';
	import { createVirtualizer } from '@tanstack/svelte-virtual';
	import type {
		ClanLeaderboardResponse,
		PlayerProfile,
		PlayerSession,
		PlayerStatsTree
	} from '$lib/types/openfront';
	import { onMount } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	type SummaryRow = {
		label: string;
		value: string;
	};

	type StatsBreakdownRow = {
		key: string;
		gameType: string;
		gameMode: string;
		difficulty: string;
		wins: bigint;
		losses: bigint;
		total: bigint;
		winRate: number;
	};

	type UsernameFrequencyRow = {
		key: string;
		username: string;
		sessionCount: number;
		lastSeen: number;
		lastSeenLabel: string;
	};

	type ClanFrequencyRow = {
		key: string;
		clan: string;
		clanTag: string | null;
		sessionCount: number;
		lastSeen: number;
		lastSeenLabel: string;
	};

	type RawUsernameRow = {
		key: string;
		rawUsername: string;
		sessionCount: number;
		lastSeen: number;
		lastSeenLabel: string;
	};

	type SortOrder = 'asc' | 'desc';
	type UsernameSortColumn = 'username' | 'sessionCount' | 'lastSeen';
	type ClanSortColumn = 'clan' | 'sessionCount' | 'lastSeen';
	type RawUsernameSortColumn = 'rawUsername' | 'sessionCount' | 'lastSeen';

	let { data } = $props<{
		data: {
			playerId: string;
			playerProfile: PlayerProfile | null;
			clanLeaderboard: ClanLeaderboardResponse | null;
			errors: {
				profile?: string;
			};
			loadedAt: string;
		};
	}>();

	const numberFormatter = new Intl.NumberFormat('en-US');
	const formatBigInt = (value: bigint | null | undefined) =>
		value === null || value === undefined ? '—' : numberFormatter.format(value);

	const parseBigInt = (value: string | undefined) => {
		if (!value) return 0n;
		try {
			return BigInt(value);
		} catch {
			return 0n;
		}
	};

	const getWinRatePercent = (wins: bigint, total: bigint) => {
		if (total <= 0n) return 0;
		const scaledPercent = (wins * 10000n) / total;
		return Number(scaledPercent) / 100;
	};

	const timestampOrZero = (value: string | undefined) => {
		if (!value) return 0;
		const parsed = Date.parse(value);
		return Number.isFinite(parsed) ? parsed : 0;
	};

	const renderDateTime = (value: string | undefined) => {
		const timestamp = timestampOrZero(value);
		return timestamp > 0 ? new Date(timestamp).toLocaleString() : '—';
	};
	const normalizeUsername = (value: string | null | undefined) =>
		String(value ?? '')
			.replace(/\[[A-Za-z0-9]{2,5}\]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	const compareStrings = (left: string, right: string) =>
		left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
	const applySortOrder = (value: number, order: SortOrder) => (order === 'asc' ? value : -value);
	const identityTableHeightClass = 'h-[60vh]';
	const estimatedRowHeight = 44;
	const rankImages = ['/images/rank-1.png', '/images/rank-2.png', '/images/rank-3.png'];
	const rankAccentColors = ['211 158 34', '127 141 154', '167 95 32'];
	const normalizeClanTag = (value: string | null | undefined) => {
		const clanTag = String(value ?? '').trim().toUpperCase();
		return clanTag || null;
	};
	const clanRankLookup = $derived.by<SvelteMap<string, number>>(() => {
		const lookup = new SvelteMap<string, number>();
		const clans: ClanLeaderboardResponse['clans'] = data.clanLeaderboard?.clans ?? [];
		for (const [index, entry] of clans.entries()) {
			lookup.set(String(entry.clanTag ?? '').toUpperCase(), index + 1);
		}
		return lookup;
	});
	const getClanRank = (clanTag: string | null) => {
		const normalizedClanTag = normalizeClanTag(clanTag);
		if (!normalizedClanTag) return null;
		return clanRankLookup.get(normalizedClanTag) ?? null;
	};

	const breakdownRows = $derived.by<StatsBreakdownRow[]>(() => {
		const rows: StatsBreakdownRow[] = [];
		const tree: PlayerStatsTree = data.playerProfile?.stats ?? {};

		for (const [gameType, modes] of Object.entries(tree)) {
			for (const [gameMode, difficulties] of Object.entries(modes)) {
				for (const [difficulty, leaf] of Object.entries(difficulties)) {
					const wins = parseBigInt(leaf.wins);
					const losses = parseBigInt(leaf.losses);
					const total = parseBigInt(leaf.total);
					rows.push({
						key: `${gameType}|${gameMode}|${difficulty}`,
						gameType,
						gameMode,
						difficulty,
						wins,
						losses,
						total,
						winRate: getWinRatePercent(wins, total)
					});
				}
			}
		}

		return rows.sort((left, right) => {
			if (left.total === right.total) return left.key.localeCompare(right.key);
			return left.total > right.total ? -1 : 1;
		});
	});

	const lifetimeTotals = $derived.by(() => {
		let wins = 0n;
		let losses = 0n;
		let total = 0n;
		const gameTypes = new SvelteSet<string>();
		const gameModes = new SvelteSet<string>();
		const difficulties = new SvelteSet<string>();

		for (const row of breakdownRows) {
			wins += row.wins;
			losses += row.losses;
			total += row.total;
			gameTypes.add(row.gameType);
			gameModes.add(row.gameMode);
			difficulties.add(row.difficulty);
		}

		return {
			wins,
			losses,
			total,
			gameTypes: gameTypes.size,
			gameModes: gameModes.size,
			difficulties: difficulties.size,
			winRate: getWinRatePercent(wins, total)
		};
	});

	let playerSessions = $state<PlayerSession[]>([]);
	let sessionsLoading = $state(true);
	let sessionsError = $state('');
	let sessionsLoadedAt = $state<string | null>(null);
	let mounted = $state(false);
	let activeSessionsAbort: AbortController | null = null;
	let activeSessionsLoadId = 0;

	let search = $state('');
	const searchSuggestions: string[] = [];

	const loadPlayerSessions = async (playerId: string) => {
		if (!playerId) {
			playerSessions = [];
			sessionsLoadedAt = null;
			sessionsLoading = false;
			sessionsError = 'Unable to load player sessions.';
			return;
		}

		activeSessionsLoadId += 1;
		const loadId = activeSessionsLoadId;

		activeSessionsAbort?.abort();
		const controller = new AbortController();
		activeSessionsAbort = controller;

		sessionsLoading = true;
		sessionsError = '';
		playerSessions = [];
		sessionsLoadedAt = null;

		try {
			const response = await fetch(`/api/players/${encodeURIComponent(playerId)}/sessions`, {
				signal: controller.signal
			});
			if (!response.ok) {
				throw new Error(`Player sessions request failed ${response.status}`);
			}

			const payload = (await response.json()) as PlayerSession[];
			if (loadId !== activeSessionsLoadId) return;

			playerSessions = [...payload].sort((left, right) => {
				const delta = timestampOrZero(right.gameStart) - timestampOrZero(left.gameStart);
				if (delta !== 0) return delta;
				return String(left.gameId ?? '').localeCompare(String(right.gameId ?? ''));
			});
			sessionsLoadedAt = new Date().toISOString();
		} catch (err) {
			if (controller.signal.aborted || loadId !== activeSessionsLoadId) return;
			console.error(`Failed to load player sessions for ${playerId}`, err);
			playerSessions = [];
			sessionsLoadedAt = null;
			sessionsError = 'Unable to load player sessions.';
		} finally {
			if (loadId === activeSessionsLoadId) {
				sessionsLoading = false;
			}
		}
	};

	const refreshPage = async () => {
		await invalidateAll();
	};

	const recentGames = $derived.by(() => {
		const games = data.playerProfile?.games ?? [];
		return [...games].sort(
			(left, right) => timestampOrZero(right.start) - timestampOrZero(left.start)
		);
	});

	const latestSession = $derived.by(() => playerSessions[0] ?? null);
	const headerClanTag = $derived.by(() => normalizeClanTag(latestSession?.clanTag));
	const headerClanRank = $derived.by(() => getClanRank(headerClanTag));
	const headerClanAccent = $derived.by(() =>
		headerClanRank && headerClanRank <= 3 ? rankAccentColors[headerClanRank - 1] : null
	);
	const displayName = $derived.by(
		() => {
			const sessionName = String(latestSession?.username ?? '').trim();
			if (sessionName) return sessionName;
			return data.playerProfile?.user?.global_name ?? data.playerProfile?.user?.username ?? null;
		}
	);

	const usernameFrequencyRows = $derived.by<UsernameFrequencyRow[]>(() => {
		const rows = new SvelteMap<string, { username: string; sessionCount: number; lastSeen: number }>();
		for (const session of playerSessions) {
			const username = normalizeUsername(session.username) || 'Unknown';
			const seenAt = timestampOrZero(session.gameStart);
			const current = rows.get(username) ?? { username, sessionCount: 0, lastSeen: 0 };
			current.sessionCount += 1;
			if (seenAt > current.lastSeen) current.lastSeen = seenAt;
			rows.set(username, current);
		}

		return Array.from(rows.values())
			.map((row) => ({
				key: row.username,
				username: row.username,
				sessionCount: row.sessionCount,
				lastSeen: row.lastSeen,
				lastSeenLabel: row.lastSeen > 0 ? new Date(row.lastSeen).toLocaleString() : '—'
			}))
			.sort((left, right) => {
				if (left.sessionCount !== right.sessionCount) return right.sessionCount - left.sessionCount;
				if (left.lastSeen !== right.lastSeen) return right.lastSeen - left.lastSeen;
				return left.username.localeCompare(right.username, undefined, {
					numeric: true,
					sensitivity: 'base'
				});
			});
	});
	let usernameSort = $state<{ column: UsernameSortColumn; order: SortOrder }>({
		column: 'sessionCount',
		order: 'desc'
	});
	const usernameSortIndicator = (column: UsernameSortColumn) =>
		usernameSort.column === column ? usernameSort.order : false;
	const toggleUsernameSort = (column: UsernameSortColumn, defaultOrder: SortOrder) => {
		usernameSort =
			usernameSort.column === column
				? { column, order: usernameSort.order === 'desc' ? 'asc' : 'desc' }
				: { column, order: defaultOrder };
	};
	const sortedUsernameFrequencyRows = $derived.by(() => {
		return [...usernameFrequencyRows].sort((left, right) => {
			const direction = usernameSort.order;
			switch (usernameSort.column) {
				case 'username':
					return applySortOrder(compareStrings(left.username, right.username), direction);
				case 'lastSeen':
					return applySortOrder(left.lastSeen - right.lastSeen, direction);
				case 'sessionCount':
				default:
					return applySortOrder(left.sessionCount - right.sessionCount, direction);
			}
		});
	});
	let usernameViewport = $state<HTMLElement | null>(null);
	let usernameHeaderEl = $state<HTMLTableSectionElement | null>(null);
	const usernameHeaderHeight = $derived.by(() => usernameHeaderEl?.clientHeight ?? 0);
	const usernameRowVirtualizer = createVirtualizer<HTMLElement, HTMLTableRowElement>({
		count: 0,
		getScrollElement: () => usernameViewport,
		estimateSize: () => estimatedRowHeight,
		overscan: 6,
		paddingStart: 0,
		getItemKey: (index) => index
	});
	const measureUsernameRow = (node: HTMLTableRowElement) => {
		$usernameRowVirtualizer.measureElement(node);
	};
	$effect(() => {
		const viewport = usernameViewport;
		const rows = sortedUsernameFrequencyRows;
		$usernameRowVirtualizer.setOptions({
			count: rows.length,
			getScrollElement: () => viewport,
			paddingStart: usernameHeaderHeight,
			getItemKey: (index) => rows[index]?.key ?? index
		});
	});
	const usernameVirtualRows = $derived.by(() => $usernameRowVirtualizer.getVirtualItems());
	const usernameVirtualPaddingTop = $derived.by(() => {
		if (usernameVirtualRows.length === 0) return 0;
		return Math.max(0, usernameVirtualRows[0].start - usernameHeaderHeight);
	});
	const usernameVirtualPaddingBottom = $derived.by(() => {
		if (usernameVirtualRows.length === 0) return 0;
		const totalSize = $usernameRowVirtualizer.getTotalSize();
		return Math.max(0, totalSize - usernameVirtualRows[usernameVirtualRows.length - 1].end);
	});

	const clanFrequencyRows = $derived.by<ClanFrequencyRow[]>(() => {
		const rows = new SvelteMap<
			string,
			{ clan: string; clanTag: string | null; sessionCount: number; lastSeen: number }
		>();
		for (const session of playerSessions) {
			const rawClanTag = String(session.clanTag ?? '').trim();
			const clanTag = rawClanTag ? rawClanTag.toUpperCase() : null;
			const clan = clanTag ?? 'No clan';
			const seenAt = timestampOrZero(session.gameStart);
			const current = rows.get(clan) ?? { clan, clanTag, sessionCount: 0, lastSeen: 0 };
			current.sessionCount += 1;
			if (seenAt > current.lastSeen) current.lastSeen = seenAt;
			rows.set(clan, current);
		}

		return Array.from(rows.values())
			.map((row) => ({
				key: row.clan,
				clan: row.clan,
				clanTag: row.clanTag,
				sessionCount: row.sessionCount,
				lastSeen: row.lastSeen,
				lastSeenLabel: row.lastSeen > 0 ? new Date(row.lastSeen).toLocaleString() : '—'
			}))
			.sort((left, right) => {
				if (left.sessionCount !== right.sessionCount) return right.sessionCount - left.sessionCount;
				if (left.lastSeen !== right.lastSeen) return right.lastSeen - left.lastSeen;
				return left.clan.localeCompare(right.clan, undefined, {
					numeric: true,
					sensitivity: 'base'
				});
			});
	});
	let clanSort = $state<{ column: ClanSortColumn; order: SortOrder }>({
		column: 'sessionCount',
		order: 'desc'
	});
	const clanSortIndicator = (column: ClanSortColumn) =>
		clanSort.column === column ? clanSort.order : false;
	const toggleClanSort = (column: ClanSortColumn, defaultOrder: SortOrder) => {
		clanSort =
			clanSort.column === column
				? { column, order: clanSort.order === 'desc' ? 'asc' : 'desc' }
				: { column, order: defaultOrder };
	};
	const sortedClanFrequencyRows = $derived.by(() => {
		return [...clanFrequencyRows].sort((left, right) => {
			const direction = clanSort.order;
			switch (clanSort.column) {
				case 'clan':
					return applySortOrder(compareStrings(left.clan, right.clan), direction);
				case 'lastSeen':
					return applySortOrder(left.lastSeen - right.lastSeen, direction);
				case 'sessionCount':
				default:
					return applySortOrder(left.sessionCount - right.sessionCount, direction);
			}
		});
	});
	let clanViewport = $state<HTMLElement | null>(null);
	let clanHeaderEl = $state<HTMLTableSectionElement | null>(null);
	const clanHeaderHeight = $derived.by(() => clanHeaderEl?.clientHeight ?? 0);
	const clanRowVirtualizer = createVirtualizer<HTMLElement, HTMLTableRowElement>({
		count: 0,
		getScrollElement: () => clanViewport,
		estimateSize: () => estimatedRowHeight,
		overscan: 6,
		paddingStart: 0,
		getItemKey: (index) => index
	});
	const measureClanRow = (node: HTMLTableRowElement) => {
		$clanRowVirtualizer.measureElement(node);
	};
	$effect(() => {
		const viewport = clanViewport;
		const rows = sortedClanFrequencyRows;
		$clanRowVirtualizer.setOptions({
			count: rows.length,
			getScrollElement: () => viewport,
			paddingStart: clanHeaderHeight,
			getItemKey: (index) => rows[index]?.key ?? index
		});
	});
	const clanVirtualRows = $derived.by(() => $clanRowVirtualizer.getVirtualItems());
	const clanVirtualPaddingTop = $derived.by(() => {
		if (clanVirtualRows.length === 0) return 0;
		return Math.max(0, clanVirtualRows[0].start - clanHeaderHeight);
	});
	const clanVirtualPaddingBottom = $derived.by(() => {
		if (clanVirtualRows.length === 0) return 0;
		const totalSize = $clanRowVirtualizer.getTotalSize();
		return Math.max(0, totalSize - clanVirtualRows[clanVirtualRows.length - 1].end);
	});

	const rawUsernameRows = $derived.by<RawUsernameRow[]>(() => {
		const rows = new SvelteMap<
			string,
			{
				rawUsername: string;
				sessionCount: number;
				lastSeen: number;
			}
		>();

		const addRawUsername = (value: string | null | undefined, incrementCount: boolean, seenAt: number) => {
			const rawUsername = String(value ?? '').trim();
			if (!rawUsername) return;
			const current = rows.get(rawUsername) ?? {
				rawUsername,
				sessionCount: 0,
				lastSeen: 0
			};

			if (incrementCount) {
				current.sessionCount += 1;
			}
			if (seenAt > current.lastSeen) current.lastSeen = seenAt;
			rows.set(rawUsername, current);
		};

		for (const session of playerSessions) {
			addRawUsername(session.username, true, timestampOrZero(session.gameStart));
		}
		const profileSeenAt = timestampOrZero(data.playerProfile?.createdAt);
		addRawUsername(data.playerProfile?.user?.global_name, false, profileSeenAt);
		addRawUsername(data.playerProfile?.user?.username, false, profileSeenAt);

		return Array.from(rows.values())
			.map((row) => ({
				key: row.rawUsername,
				rawUsername: row.rawUsername,
				sessionCount: row.sessionCount,
				lastSeen: row.lastSeen,
				lastSeenLabel: row.lastSeen > 0 ? new Date(row.lastSeen).toLocaleString() : '—'
			}))
			.sort((left, right) => {
				if (left.sessionCount !== right.sessionCount) return right.sessionCount - left.sessionCount;
				if (left.lastSeen !== right.lastSeen) return right.lastSeen - left.lastSeen;
				return left.rawUsername.localeCompare(right.rawUsername, undefined, {
					numeric: true,
					sensitivity: 'base'
				});
			});
	});
	let rawUsernameSort = $state<{ column: RawUsernameSortColumn; order: SortOrder }>({
		column: 'sessionCount',
		order: 'desc'
	});
	const rawUsernameSortIndicator = (column: RawUsernameSortColumn) =>
		rawUsernameSort.column === column ? rawUsernameSort.order : false;
	const toggleRawUsernameSort = (column: RawUsernameSortColumn, defaultOrder: SortOrder) => {
		rawUsernameSort =
			rawUsernameSort.column === column
				? { column, order: rawUsernameSort.order === 'desc' ? 'asc' : 'desc' }
				: { column, order: defaultOrder };
	};
	const sortedRawUsernameRows = $derived.by(() => {
		return [...rawUsernameRows].sort((left, right) => {
			const direction = rawUsernameSort.order;
			switch (rawUsernameSort.column) {
				case 'rawUsername':
					return applySortOrder(compareStrings(left.rawUsername, right.rawUsername), direction);
				case 'lastSeen':
					return applySortOrder(left.lastSeen - right.lastSeen, direction);
				case 'sessionCount':
				default:
					return applySortOrder(left.sessionCount - right.sessionCount, direction);
			}
		});
	});
	let rawUsernameViewport = $state<HTMLElement | null>(null);
	let rawUsernameHeaderEl = $state<HTMLTableSectionElement | null>(null);
	const rawUsernameHeaderHeight = $derived.by(() => rawUsernameHeaderEl?.clientHeight ?? 0);
	const rawUsernameRowVirtualizer = createVirtualizer<HTMLElement, HTMLTableRowElement>({
		count: 0,
		getScrollElement: () => rawUsernameViewport,
		estimateSize: () => estimatedRowHeight,
		overscan: 6,
		paddingStart: 0,
		getItemKey: (index) => index
	});
	const measureRawUsernameRow = (node: HTMLTableRowElement) => {
		$rawUsernameRowVirtualizer.measureElement(node);
	};
	$effect(() => {
		const viewport = rawUsernameViewport;
		const rows = sortedRawUsernameRows;
		$rawUsernameRowVirtualizer.setOptions({
			count: rows.length,
			getScrollElement: () => viewport,
			paddingStart: rawUsernameHeaderHeight,
			getItemKey: (index) => rows[index]?.key ?? index
		});
	});
	const rawUsernameVirtualRows = $derived.by(() => $rawUsernameRowVirtualizer.getVirtualItems());
	const rawUsernameVirtualPaddingTop = $derived.by(() => {
		if (rawUsernameVirtualRows.length === 0) return 0;
		return Math.max(0, rawUsernameVirtualRows[0].start - rawUsernameHeaderHeight);
	});
	const rawUsernameVirtualPaddingBottom = $derived.by(() => {
		if (rawUsernameVirtualRows.length === 0) return 0;
		const totalSize = $rawUsernameRowVirtualizer.getTotalSize();
		return Math.max(
			0,
			totalSize - rawUsernameVirtualRows[rawUsernameVirtualRows.length - 1].end
		);
	});

	const summaryRows = $derived.by<SummaryRow[]>(() => [
		{ label: 'Created', value: renderDateTime(data.playerProfile?.createdAt) },
		{ label: 'Games', value: formatBigInt(lifetimeTotals.total) },
		{ label: 'Wins', value: formatBigInt(lifetimeTotals.wins) },
		{ label: 'Losses', value: formatBigInt(lifetimeTotals.losses) },
		{ label: 'Win rate', value: displayPercent(lifetimeTotals.winRate) ?? '—' },
		{ label: 'Game types', value: numberFormatter.format(lifetimeTotals.gameTypes) },
		{ label: 'Game modes', value: numberFormatter.format(lifetimeTotals.gameModes) },
		{ label: 'Difficulties', value: numberFormatter.format(lifetimeTotals.difficulties) },
		{
			label: 'Loaded sessions',
			value: sessionsLoading ? 'Loading…' : numberFormatter.format(playerSessions.length)
		}
	]);

	const renderDateRange = () => {
		const timestamps = [
			...recentGames.map((game) => timestampOrZero(game.start)),
			...playerSessions.map((session) => timestampOrZero(session.gameStart))
		].filter((value) => value > 0);

		if (timestamps.length === 0) return '—';
		const start = new Date(Math.min(...timestamps)).toLocaleDateString();
		const end = new Date(Math.max(...timestamps)).toLocaleDateString();
		return `${start} → ${end}`;
	};

	const renderLastUpdated = () => {
		const timestamp = sessionsLoadedAt ?? data.loadedAt;
		const date = new Date(timestamp);
		if (Number.isNaN(date.getTime())) return '—';
		return date.toLocaleTimeString();
	};

	onMount(() => {
		mounted = true;
		return () => {
			activeSessionsAbort?.abort();
		};
	});

	$effect(() => {
		if (!browser || !mounted) return;
		const playerId = data.playerId;
		const reloadToken = data.loadedAt;
		const profileUsername = data.playerProfile?.user?.username?.trim() ?? '';
		if (profileUsername) {
			addRecentlyViewed({ kind: 'player', id: playerId, label: profileUsername });
		}
		void reloadToken;
		void loadPlayerSessions(playerId);
	});

	$effect(() => {
		if (!browser || !mounted) return;
		const rawUsername = String(latestSession?.username ?? '').trim();
		if (!rawUsername) return;
		addRecentlyViewed({ kind: 'player', id: data.playerId, label: rawUsername });
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
			<Card.Root>
				<Card.Header class="gap-2">
					<div class="flex flex-wrap items-center gap-2">
						<h2 class="text-2xl font-semibold">{displayName ?? 'Player'}</h2>
						{#if headerClanTag}
							<Badge
								variant={headerClanRank === 1 ? 'default' : 'secondary'}
								style={headerClanAccent ? `--rank-accent: ${headerClanAccent}` : ''}
								class={headerClanAccent
									? 'border-[rgb(var(--rank-accent)/0.45)] bg-[rgb(var(--rank-accent)/0.15)] text-[rgb(var(--rank-accent)/1)]'
									: ''}
							>
								{#if headerClanRank && headerClanRank <= 3 && rankImages[headerClanRank - 1]}
									<img
										src={rankImages[headerClanRank - 1]}
										alt={`Rank ${headerClanRank}`}
										class="-ml-0.5 h-4 w-4 origin-center scale-[1.3] object-cover opacity-100"
										loading="lazy"
									/>
								{/if}
								{headerClanTag}
							</Badge>
						{/if}
						<Badge variant="outline">{data.playerId}</Badge>
					</div>
				</Card.Header>
				<Card.Content class="grid gap-4 text-sm">
					{#if !data.playerProfile}
						<Empty.Root class="border-muted-foreground/30">
							<h3 class="text-lg font-semibold">No player profile</h3>
							<p class="text-sm text-muted-foreground">
								Profile details were not available for this player id.
							</p>
						</Empty.Root>
					{:else}
						<Table.Root class="min-w-full table-fixed">
							<Table.Header class="bg-card">
								<Table.Row>
									<Table.Head class="w-1/2">Metric</Table.Head>
									<Table.Head class="text-right">Value</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each summaryRows as row (row.label)}
									<Table.Row>
										<Table.Cell class="text-muted-foreground">{row.label}</Table.Cell>
										<Table.Cell class="text-right font-medium">{row.value}</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					{/if}
				</Card.Content>
			</Card.Root>
		</section>

		{#if data.errors.profile}
			<Alert.Root variant="destructive">
				<Alert.Title>Player profile unavailable</Alert.Title>
				<Alert.Description>{data.errors.profile}</Alert.Description>
			</Alert.Root>
		{/if}

		<section class="flex flex-col gap-4">
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-xl">Stats breakdown</Card.Title>
					<Card.Description>Per type, mode, and difficulty.</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if breakdownRows.length === 0}
						<Empty.Root class="border-muted-foreground/30">
							<h3 class="text-lg font-semibold">No stats breakdown</h3>
							<p class="text-sm text-muted-foreground">No detailed rows were available.</p>
						</Empty.Root>
					{:else}
						<Table.Root class="min-w-full table-fixed">
							<Table.Header class="bg-card">
								<Table.Row>
									<Table.Head>Type</Table.Head>
									<Table.Head>Mode</Table.Head>
									<Table.Head>Difficulty</Table.Head>
									<Table.Head class="text-right">Games</Table.Head>
									<Table.Head class="text-right">Wins</Table.Head>
									<Table.Head class="text-right">Losses</Table.Head>
									<Table.Head class="text-right">Win rate</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each breakdownRows as row (row.key)}
									<Table.Row>
										<Table.Cell>{row.gameType}</Table.Cell>
										<Table.Cell>{row.gameMode}</Table.Cell>
										<Table.Cell>{row.difficulty}</Table.Cell>
										<Table.Cell class="text-right">{formatBigInt(row.total)}</Table.Cell>
										<Table.Cell class="text-right">{formatBigInt(row.wins)}</Table.Cell>
										<Table.Cell class="text-right">{formatBigInt(row.losses)}</Table.Cell>
										<Table.Cell class="text-right">
											{displayPercent(row.winRate) ?? '—'}
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					{/if}
				</Card.Content>
			</Card.Root>
		</section>

		<section class="flex flex-col gap-4">
			<PlayerCharts {playerSessions} {sessionsLoading} {sessionsError} />
		</section>

		<section class="flex flex-col gap-4">
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-xl">Public sessions</Card.Title>
					<Card.Description>
						Complete session history from the public player sessions endpoint.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<PlayerSessionsTable {playerSessions} {sessionsLoading} {sessionsError} />
				</Card.Content>
			</Card.Root>
		</section>

		<section class="flex flex-col gap-4">
			<PlayerIdentityCharts {playerSessions} />
		</section>

		<section class="grid gap-4 lg:grid-cols-2">
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-xl">Names</Card.Title>
					<Card.Description>Normalized names grouped by session count.</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if usernameFrequencyRows.length === 0 && sessionsLoading}
						<Empty.Root class="border-muted-foreground/30">
							<h3 class="text-lg font-semibold">Loading usernames...</h3>
							<p class="text-sm text-muted-foreground">
								Checking public sessions for this player id.
							</p>
						</Empty.Root>
					{:else if usernameFrequencyRows.length === 0}
						<Empty.Root class="border-muted-foreground/30">
							<h3 class="text-lg font-semibold">No usernames found</h3>
							<p class="text-sm text-muted-foreground">
								No username records were available from public data.
							</p>
						</Empty.Root>
					{:else}
						<ScrollArea.Root
							class={`${identityTableHeightClass} w-full [&_[data-slot='scroll-area-viewport']]:[scrollbar-gutter:stable_both-edges] [&_[data-slot='table-container']]:overflow-visible`}
							orientation="both"
							scrollbarXClasses="z-20"
							scrollbarYClasses="z-20"
							bind:viewportRef={usernameViewport}
						>
							<Table.Root class="min-w-full table-fixed">
								<Table.Header bind:ref={usernameHeaderEl} class="bg-card">
									<Table.Row class="hover:[&,&>svelte-css-wrapper]:[&>th,td]:!bg-card">
										<Table.Head
											class="sticky top-0 z-10 border-l border-border/40 bg-card first:border-l-0"
										>
											<DataTableSortHeader
												label="Username"
												onClick={() => toggleUsernameSort('username', 'asc')}
												isSorted={usernameSortIndicator('username')}
											/>
										</Table.Head>
										<Table.Head
											class="sticky top-0 z-10 border-l border-border/40 bg-card text-right first:border-l-0"
										>
											<DataTableSortHeader
												label="Sessions"
												onClick={() => toggleUsernameSort('sessionCount', 'desc')}
												isSorted={usernameSortIndicator('sessionCount')}
											/>
										</Table.Head>
										<Table.Head
											class="sticky top-0 z-10 border-l border-border/40 bg-card text-right first:border-l-0"
										>
											<DataTableSortHeader
												label="Last seen"
												onClick={() => toggleUsernameSort('lastSeen', 'desc')}
												isSorted={usernameSortIndicator('lastSeen')}
											/>
										</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#if usernameVirtualPaddingTop > 0}
										<Table.Row>
											<Table.Cell colspan={3} class="p-0">
												<div style={`height: ${usernameVirtualPaddingTop}px`}></div>
											</Table.Cell>
										</Table.Row>
									{/if}
									{#each usernameVirtualRows as virtualRow (sortedUsernameFrequencyRows[virtualRow.index]?.key ?? virtualRow.key)}
										{@const row = sortedUsernameFrequencyRows[virtualRow.index]}
										{#if row}
											<tr
												data-slot="table-row"
												data-index={virtualRow.index}
												use:measureUsernameRow
												class="border-b transition-colors hover:bg-muted/60 hover:[&,&>svelte-css-wrapper]:[&>th,td]:bg-muted/50"
											>
												<Table.Cell class="border-l border-border/40 font-medium first:border-l-0">
													{row.username}
												</Table.Cell>
												<Table.Cell class="border-l border-border/40 text-right first:border-l-0">
													{numberFormatter.format(row.sessionCount)}
												</Table.Cell>
												<Table.Cell class="border-l border-border/40 text-right first:border-l-0">
													{row.lastSeenLabel}
												</Table.Cell>
											</tr>
										{/if}
									{/each}
									{#if usernameVirtualPaddingBottom > 0}
										<Table.Row>
											<Table.Cell colspan={3} class="p-0">
												<div style={`height: ${usernameVirtualPaddingBottom}px`}></div>
											</Table.Cell>
										</Table.Row>
									{/if}
								</Table.Body>
							</Table.Root>
						</ScrollArea.Root>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title class="text-xl">Clans</Card.Title>
					<Card.Description>Clan tags grouped by session count.</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if clanFrequencyRows.length === 0 && sessionsLoading}
						<Empty.Root class="border-muted-foreground/30">
							<h3 class="text-lg font-semibold">Loading clans...</h3>
							<p class="text-sm text-muted-foreground">
								Checking public sessions for this player id.
							</p>
						</Empty.Root>
					{:else if clanFrequencyRows.length === 0}
						<Empty.Root class="border-muted-foreground/30">
							<h3 class="text-lg font-semibold">No clans found</h3>
							<p class="text-sm text-muted-foreground">
								No clan records were available from public data.
							</p>
						</Empty.Root>
					{:else}
						<ScrollArea.Root
							class={`${identityTableHeightClass} w-full [&_[data-slot='scroll-area-viewport']]:[scrollbar-gutter:stable_both-edges] [&_[data-slot='table-container']]:overflow-visible`}
							orientation="both"
							scrollbarXClasses="z-20"
							scrollbarYClasses="z-20"
							bind:viewportRef={clanViewport}
						>
							<Table.Root class="min-w-full table-fixed">
								<Table.Header bind:ref={clanHeaderEl} class="bg-card">
									<Table.Row class="hover:[&,&>svelte-css-wrapper]:[&>th,td]:!bg-card">
										<Table.Head
											class="sticky top-0 z-10 border-l border-border/40 bg-card first:border-l-0"
										>
											<DataTableSortHeader
												label="Clan"
												onClick={() => toggleClanSort('clan', 'asc')}
												isSorted={clanSortIndicator('clan')}
											/>
										</Table.Head>
										<Table.Head
											class="sticky top-0 z-10 border-l border-border/40 bg-card text-right first:border-l-0"
										>
											<DataTableSortHeader
												label="Sessions"
												onClick={() => toggleClanSort('sessionCount', 'desc')}
												isSorted={clanSortIndicator('sessionCount')}
											/>
										</Table.Head>
										<Table.Head
											class="sticky top-0 z-10 border-l border-border/40 bg-card text-right first:border-l-0"
										>
											<DataTableSortHeader
												label="Last seen"
												onClick={() => toggleClanSort('lastSeen', 'desc')}
												isSorted={clanSortIndicator('lastSeen')}
											/>
										</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#if clanVirtualPaddingTop > 0}
										<Table.Row>
											<Table.Cell colspan={3} class="p-0">
												<div style={`height: ${clanVirtualPaddingTop}px`}></div>
											</Table.Cell>
										</Table.Row>
									{/if}
									{#each clanVirtualRows as virtualRow (sortedClanFrequencyRows[virtualRow.index]?.key ?? virtualRow.key)}
										{@const row = sortedClanFrequencyRows[virtualRow.index]}
										{#if row}
											{@const clanRank = getClanRank(row.clanTag)}
											<tr
												data-slot="table-row"
												data-index={virtualRow.index}
												use:measureClanRow
												class={`border-b transition-colors hover:bg-muted/60 hover:[&,&>svelte-css-wrapper]:[&>th,td]:bg-muted/50 ${clanRank && clanRank <= 3 ? 'bg-[linear-gradient(90deg,_rgb(var(--rank-accent)/0.12)_0%,_rgb(var(--rank-accent)/0.05)_18%,_transparent_55%)] shadow-[inset_3px_0_0_rgb(var(--rank-accent)/0.9)]' : ''}`}
												style={clanRank && clanRank <= 3
													? `--rank-accent: ${rankAccentColors[clanRank - 1]}`
													: ''}
											>
												<Table.Cell class="border-l border-border/40 font-medium first:border-l-0">
													<div class="inline-flex items-center gap-2">
														{#if clanRank && clanRank <= 3 && rankImages[clanRank - 1]}
															<img
																src={rankImages[clanRank - 1]}
																alt={`Rank ${clanRank}`}
																class="h-4 w-4 origin-center scale-[1.35] object-cover opacity-100"
																loading="lazy"
															/>
														{/if}
														{#if row.clanTag}
															<a
																href={resolve(`/clans/${encodeURIComponent(row.clanTag)}`)}
																class="underline decoration-dotted underline-offset-4 hover:text-foreground"
															>
																{row.clan}
															</a>
														{:else}
															{row.clan}
														{/if}
													</div>
												</Table.Cell>
												<Table.Cell class="border-l border-border/40 text-right first:border-l-0">
													{numberFormatter.format(row.sessionCount)}
												</Table.Cell>
												<Table.Cell class="border-l border-border/40 text-right first:border-l-0">
													{row.lastSeenLabel}
												</Table.Cell>
											</tr>
										{/if}
									{/each}
									{#if clanVirtualPaddingBottom > 0}
										<Table.Row>
											<Table.Cell colspan={3} class="p-0">
												<div style={`height: ${clanVirtualPaddingBottom}px`}></div>
											</Table.Cell>
										</Table.Row>
									{/if}
								</Table.Body>
							</Table.Root>
						</ScrollArea.Root>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root class="lg:col-span-2">
				<Card.Header>
					<Card.Title class="text-xl">Usernames</Card.Title>
					<Card.Description>Raw username values from sessions and profile data.</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if rawUsernameRows.length === 0 && sessionsLoading}
						<Empty.Root class="border-muted-foreground/30">
							<h3 class="text-lg font-semibold">Loading raw usernames...</h3>
							<p class="text-sm text-muted-foreground">
								Checking public sessions for this player id.
							</p>
						</Empty.Root>
					{:else if rawUsernameRows.length === 0}
						<Empty.Root class="border-muted-foreground/30">
							<h3 class="text-lg font-semibold">No raw usernames found</h3>
							<p class="text-sm text-muted-foreground">
								No raw username values were available from public data.
							</p>
						</Empty.Root>
					{:else}
						<ScrollArea.Root
							class={`${identityTableHeightClass} w-full [&_[data-slot='scroll-area-viewport']]:[scrollbar-gutter:stable_both-edges] [&_[data-slot='table-container']]:overflow-visible`}
							orientation="both"
							scrollbarXClasses="z-20"
							scrollbarYClasses="z-20"
							bind:viewportRef={rawUsernameViewport}
						>
							<Table.Root class="min-w-full table-fixed">
								<Table.Header bind:ref={rawUsernameHeaderEl} class="bg-card">
									<Table.Row class="hover:[&,&>svelte-css-wrapper]:[&>th,td]:!bg-card">
										<Table.Head
											class="sticky top-0 z-10 border-l border-border/40 bg-card first:border-l-0"
										>
											<DataTableSortHeader
												label="Username"
												onClick={() => toggleRawUsernameSort('rawUsername', 'asc')}
												isSorted={rawUsernameSortIndicator('rawUsername')}
											/>
										</Table.Head>
										<Table.Head
											class="sticky top-0 z-10 border-l border-border/40 bg-card text-right first:border-l-0"
										>
											<DataTableSortHeader
												label="Sessions"
												onClick={() => toggleRawUsernameSort('sessionCount', 'desc')}
												isSorted={rawUsernameSortIndicator('sessionCount')}
											/>
										</Table.Head>
										<Table.Head
											class="sticky top-0 z-10 border-l border-border/40 bg-card text-right first:border-l-0"
										>
											<DataTableSortHeader
												label="Last seen"
												onClick={() => toggleRawUsernameSort('lastSeen', 'desc')}
												isSorted={rawUsernameSortIndicator('lastSeen')}
											/>
										</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#if rawUsernameVirtualPaddingTop > 0}
										<Table.Row>
											<Table.Cell colspan={3} class="p-0">
												<div style={`height: ${rawUsernameVirtualPaddingTop}px`}></div>
											</Table.Cell>
										</Table.Row>
									{/if}
									{#each rawUsernameVirtualRows as virtualRow (sortedRawUsernameRows[virtualRow.index]?.key ?? virtualRow.key)}
										{@const row = sortedRawUsernameRows[virtualRow.index]}
										{#if row}
											<tr
												data-slot="table-row"
												data-index={virtualRow.index}
												use:measureRawUsernameRow
												class="border-b transition-colors hover:bg-muted/60 hover:[&,&>svelte-css-wrapper]:[&>th,td]:bg-muted/50"
											>
												<Table.Cell class="border-l border-border/40 font-medium first:border-l-0">
													{row.rawUsername}
												</Table.Cell>
												<Table.Cell class="border-l border-border/40 text-right first:border-l-0">
													{row.sessionCount > 0 ? numberFormatter.format(row.sessionCount) : '—'}
												</Table.Cell>
												<Table.Cell class="border-l border-border/40 text-right first:border-l-0">
													{row.lastSeenLabel}
												</Table.Cell>
											</tr>
										{/if}
									{/each}
									{#if rawUsernameVirtualPaddingBottom > 0}
										<Table.Row>
											<Table.Cell colspan={3} class="p-0">
												<div style={`height: ${rawUsernameVirtualPaddingBottom}px`}></div>
											</Table.Cell>
										</Table.Row>
									{/if}
								</Table.Body>
							</Table.Root>
						</ScrollArea.Root>
					{/if}
				</Card.Content>
			</Card.Root>
		</section>
	</div>
</div>
