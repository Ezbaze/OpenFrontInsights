<script lang="ts">
	import {
		type ColumnDef,
		type SortingState,
		type VisibilityState,
		getCoreRowModel,
		getSortedRowModel
	} from '@tanstack/table-core';
	import { createVirtualizer } from '@tanstack/svelte-virtual';
	import * as Table from '$lib/components/ui/table';
	import * as Skeleton from '$lib/components/ui/skeleton';
	import * as Empty from '$lib/components/ui/empty';
	import * as Alert from '$lib/components/ui/alert';
	import * as ScrollArea from '$lib/components/ui/scroll-area';
	import { get } from 'svelte/store';
	import {
		createSvelteTable,
		FlexRender,
		renderComponent,
		renderSnippet
	} from '$lib/components/ui/data-table';
	import DataTableSortHeader from './DataTableSortHeader.svelte';

	type ClanSession = Record<string, unknown>;
	type ColumnMeta = { align?: 'right' };

	let {
		clanSessions = [],
		sessionsLoading = false,
		sessionsError = '',
		heightClass = 'h-[60vh]',
		focusSessionKey = null
	} = $props<{
		clanSessions?: ClanSession[];
		sessionsLoading?: boolean;
		sessionsError?: string;
		heightClass?: string;
		focusSessionKey?: string | null;
	}>();

	const formatMaybeNumber = (value: unknown) => {
		if (value === null || value === undefined || value === '') return '—';
		const numeric = Number(value);
		return Number.isFinite(numeric) ? numeric.toLocaleString() : String(value);
	};

	const formatDateTime = (value: unknown) => {
		if (!value) return '—';
		const date = new Date(String(value));
		if (Number.isNaN(date.getTime())) return String(value);
		return date.toLocaleString();
	};

	const getSessionResult = (session: ClanSession) => {
		if (typeof session.hasWon === 'boolean') return session.hasWon ? 'Win' : 'Loss';
		const result = session.result ?? session.outcome ?? session.status;
		return result ? String(result) : '—';
	};

	const rawValues = {
		game: (session: ClanSession) =>
			session.gameId ?? session.game ?? session.id ?? session.sessionId ?? session.matchId,
		start: (session: ClanSession) =>
			session.gameStart ??
			session.start ??
			session.startedAt ??
			session.startTime ??
			session.createdAt,
		end: (session: ClanSession) => session.end ?? session.endedAt ?? session.endTime,
		result: (session: ClanSession) => getSessionResult(session),
		teams: (session: ClanSession) => session.numTeams ?? session.teams,
		clanPlayers: (session: ClanSession) => session.clanPlayerCount ?? session.clanPlayers,
		players: (session: ClanSession) =>
			session.totalPlayerCount ?? session.playerCount ?? session.players
	} as const;

	const getSessionKey = (session: ClanSession) => {
		const candidate =
			rawValues.game(session) ?? session.sessionId ?? session.matchId ?? rawValues.start(session);
		if (candidate !== undefined && candidate !== null) return String(candidate);
		return JSON.stringify(session);
	};

	const getGameUrl = (session: ClanSession) => {
		const value = rawValues.game(session);
		if (value === null || value === undefined || value === '') return null;
		return `https://openfront.io/game/${encodeURIComponent(String(value))}`;
	};

	const sortValue = {
		game: (session: ClanSession) => {
			const value = rawValues.game(session);
			return value === null || value === undefined || value === ''
				? null
				: String(value).toLowerCase();
		},
		start: (session: ClanSession) => {
			const value = rawValues.start(session);
			const timestamp = Date.parse(String(value));
			return Number.isNaN(timestamp) ? null : timestamp;
		},
		end: (session: ClanSession) => {
			const value = rawValues.end(session);
			const timestamp = Date.parse(String(value));
			return Number.isNaN(timestamp) ? null : timestamp;
		},
		result: (session: ClanSession) => {
			const value = rawValues.result(session);
			return value === null || value === undefined || value === ''
				? null
				: String(value).toLowerCase();
		},
		teams: (session: ClanSession) => {
			const value = rawValues.teams(session);
			const numeric = Number(value);
			return Number.isFinite(numeric) ? numeric : null;
		},
		clanPlayers: (session: ClanSession) => {
			const value = rawValues.clanPlayers(session);
			const numeric = Number(value);
			return Number.isFinite(numeric) ? numeric : null;
		},
		players: (session: ClanSession) => {
			const value = rawValues.players(session);
			const numeric = Number(value);
			return Number.isFinite(numeric) ? numeric : null;
		}
	} as const;

	const compareNullable = (left: unknown, right: unknown) => {
		if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
		if (right === null || right === undefined) return -1;
		if (typeof left === 'string' && typeof right === 'string') return left.localeCompare(right);
		return Number(left) - Number(right);
	};

	const makeSortingFn =
		() =>
		(
			rowA: { getValue: (id: string) => unknown },
			rowB: { getValue: (id: string) => unknown },
			columnId: string
		) =>
			compareNullable(rowA.getValue(columnId), rowB.getValue(columnId));

	let sorting = $state<SortingState>([{ id: 'start', desc: true }]);

	const columnVisibility = $derived.by<VisibilityState>(() => ({
		game: clanSessions.some((session: ClanSession) => {
			const value = rawValues.game(session);
			return value !== null && value !== undefined && value !== '';
		}),
		start: clanSessions.some((session: ClanSession) => {
			const value = rawValues.start(session);
			return value !== null && value !== undefined && value !== '';
		}),
		end: clanSessions.some((session: ClanSession) => {
			const value = rawValues.end(session);
			return value !== null && value !== undefined && value !== '';
		}),
		result: clanSessions.some((session: ClanSession) => {
			const value = rawValues.result(session);
			return value !== null && value !== undefined && value !== '';
		}),
		teams: clanSessions.some((session: ClanSession) => {
			const value = rawValues.teams(session);
			return value !== null && value !== undefined && value !== '';
		}),
		clanPlayers: clanSessions.some((session: ClanSession) => {
			const value = rawValues.clanPlayers(session);
			return value !== null && value !== undefined && value !== '';
		}),
		players: clanSessions.some((session: ClanSession) => {
			const value = rawValues.players(session);
			return value !== null && value !== undefined && value !== '';
		})
	}));

	const columns: ColumnDef<ClanSession, unknown>[] = [
		{
			id: 'game',
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: 'Game',
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted()
				}),
			accessorFn: (session) => sortValue.game(session),
			sortingFn: makeSortingFn(),
			cell: ({ row }) => {
				const value = rawValues.game(row.original);
				return value
					? renderSnippet(gameLink, {
							label: String(value),
							href: getGameUrl(row.original)
						})
					: '—';
			}
		},
		{
			id: 'start',
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: 'Start',
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted()
				}),
			accessorFn: (session) => sortValue.start(session),
			sortingFn: makeSortingFn(),
			cell: ({ row }) => formatDateTime(rawValues.start(row.original))
		},
		{
			id: 'end',
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: 'End',
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted()
				}),
			accessorFn: (session) => sortValue.end(session),
			sortingFn: makeSortingFn(),
			cell: ({ row }) => formatDateTime(rawValues.end(row.original))
		},
		{
			id: 'result',
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: 'Result',
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted()
				}),
			accessorFn: (session) => sortValue.result(session),
			sortingFn: makeSortingFn(),
			cell: ({ row }) => String(rawValues.result(row.original) ?? '—')
		},
		{
			id: 'teams',
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: 'Teams',
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted()
				}),
			accessorFn: (session) => sortValue.teams(session),
			sortingFn: makeSortingFn(),
			cell: ({ row }) => formatMaybeNumber(rawValues.teams(row.original)),
			meta: { align: 'right' } satisfies ColumnMeta
		},
		{
			id: 'clanPlayers',
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: 'Clan Players',
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted()
				}),
			accessorFn: (session) => sortValue.clanPlayers(session),
			sortingFn: makeSortingFn(),
			cell: ({ row }) => formatMaybeNumber(rawValues.clanPlayers(row.original)),
			meta: { align: 'right' } satisfies ColumnMeta
		},
		{
			id: 'players',
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: 'Players',
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted()
				}),
			accessorFn: (session) => sortValue.players(session),
			sortingFn: makeSortingFn(),
			cell: ({ row }) => formatMaybeNumber(rawValues.players(row.original)),
			meta: { align: 'right' } satisfies ColumnMeta
		}
	];

	const table = createSvelteTable({
		get data() {
			return clanSessions;
		},
		columns,
		getRowId: (row) => getSessionKey(row),
		state: {
			get sorting() {
				return sorting;
			},
			get columnVisibility() {
				return columnVisibility;
			}
		},
		onSortingChange: (updater) => {
			if (typeof updater === 'function') {
				sorting = updater(sorting);
			} else {
				sorting = updater;
			}
		},
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel()
	});

	const tableRows = $derived.by(() => table.getRowModel().rows);

	let sessionsViewport = $state<HTMLElement | null>(null);
	let sessionsHeaderEl = $state<HTMLTableSectionElement | null>(null);
	const sessionsHeaderHeight = $derived.by(() => sessionsHeaderEl?.clientHeight ?? 0);

	const estimatedRowHeight = 44;
	const rowVirtualizer = createVirtualizer<HTMLElement, HTMLTableRowElement>({
		count: tableRows.length,
		getScrollElement: () => sessionsViewport,
		estimateSize: () => estimatedRowHeight,
		overscan: 6,
		paddingStart: sessionsHeaderHeight,
		getItemKey: (index) => tableRows[index]?.id ?? index
	});

	const measureRow = (node: HTMLTableRowElement) => {
		$rowVirtualizer.measureElement(node);
	};

	$effect(() => {
		const rows = tableRows;
		const viewport = sessionsViewport;
		$rowVirtualizer.setOptions({
			count: rows.length,
			getScrollElement: () => viewport,
			paddingStart: sessionsHeaderHeight,
			getItemKey: (index) => rows[index]?.id ?? index
		});
	});

	const virtualRows = $derived.by(() => $rowVirtualizer.getVirtualItems());
	const sessionsVirtualPaddingTop = $derived.by(() => {
		if (virtualRows.length === 0) return 0;
		return Math.max(0, virtualRows[0].start - sessionsHeaderHeight);
	});
	const sessionsVirtualPaddingBottom = $derived.by(() => {
		if (virtualRows.length === 0) return 0;
		const totalSize = $rowVirtualizer.getTotalSize();
		return Math.max(0, totalSize - virtualRows[virtualRows.length - 1].end);
	});

	$effect(() => {
		const target = focusSessionKey;
		const viewport = sessionsViewport;
		if (!target || !viewport) return;
		const rows = tableRows;
		const targetIndex = rows.findIndex((row) => row.id === target);
		if (targetIndex < 0) return;
		get(rowVirtualizer).scrollToIndex(targetIndex, { align: 'center' });
	});
</script>

{#snippet gameLink({ label, href }: { label: string; href: string | null })}
	{#if href}
		<a
			{href}
			target="_blank"
			rel="noopener noreferrer external"
			class="text-primary underline-offset-4 hover:underline"
		>
			{label}
		</a>
	{:else}
		{label}
	{/if}
{/snippet}

{#if sessionsError}
	<Alert.Root variant="destructive">
		<Alert.Title>Games unavailable</Alert.Title>
		<Alert.Description>{sessionsError}</Alert.Description>
	</Alert.Root>
{:else if sessionsLoading && clanSessions.length === 0}
	<div class="grid gap-3">
		{#each Array.from({ length: 5 }, (_, idx) => idx) as idx (idx)}
			<Skeleton.Root class="h-10 w-full" />
		{/each}
	</div>
{:else if clanSessions.length === 0}
	<Empty.Root class="border-muted-foreground/30">
		<h3 class="text-lg font-semibold">No games found</h3>
		<p class="text-sm text-muted-foreground">
			This clan has no recent public team games in the API range.
		</p>
	</Empty.Root>
{:else}
	<ScrollArea.Root
		class={`${heightClass} w-full [&_[data-slot='scroll-area-viewport']]:[scrollbar-gutter:stable_both-edges] [&_[data-slot='table-container']]:overflow-visible`}
		orientation="both"
		scrollbarXClasses="z-20"
		scrollbarYClasses="z-20"
		bind:viewportRef={sessionsViewport}
	>
		<Table.Root class="min-w-full table-fixed">
			<Table.Header bind:ref={sessionsHeaderEl} class="bg-card">
				{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
					<Table.Row class="hover:[&,&>svelte-css-wrapper]:[&>th,td]:!bg-card">
						{#each headerGroup.headers as header (header.id)}
							{@const meta = header.column.columnDef.meta as ColumnMeta | undefined}
							{@const align = meta?.align}
							<Table.Head
								colspan={header.colSpan}
								class={[
									'sticky top-0 z-10 border-l border-border/40 bg-card first:border-l-0',
									align === 'right' ? 'text-right' : ''
								]
									.filter(Boolean)
									.join(' ')}
							>
								{#if !header.isPlaceholder}
									<FlexRender
										content={header.column.columnDef.header}
										context={header.getContext()}
									/>
								{/if}
							</Table.Head>
						{/each}
					</Table.Row>
				{/each}
			</Table.Header>
			<Table.Body>
				{#if sessionsVirtualPaddingTop > 0}
					<Table.Row>
						<Table.Cell colspan={Math.max(1, table.getVisibleLeafColumns().length)} class="p-0">
							<div style={`height: ${sessionsVirtualPaddingTop}px`}></div>
						</Table.Cell>
					</Table.Row>
				{/if}
				{#each virtualRows as virtualRow (tableRows[virtualRow.index]?.id ?? virtualRow.key)}
					{@const row = tableRows[virtualRow.index]}
					{#if row}
						{@const isFocused = row.id === focusSessionKey}
						<tr
							data-slot="table-row"
							data-index={virtualRow.index}
							use:measureRow
							class={`border-b transition-colors hover:bg-muted/60 hover:[&,&>svelte-css-wrapper]:[&>th,td]:bg-muted/50 ${isFocused ? 'bg-muted/40 outline outline-1 outline-border/60' : ''}`}
						>
							{#each row.getVisibleCells() as cell (cell.id)}
								{@const meta = cell.column.columnDef.meta as ColumnMeta | undefined}
								{@const align = meta?.align}
								<Table.Cell
									class={[
										'border-l border-border/40 first:border-l-0',
										align === 'right' ? 'text-right' : ''
									]
										.filter(Boolean)
										.join(' ')}
								>
									<FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
								</Table.Cell>
							{/each}
						</tr>
					{/if}
				{/each}
				{#if sessionsVirtualPaddingBottom > 0}
					<Table.Row>
						<Table.Cell colspan={Math.max(1, table.getVisibleLeafColumns().length)} class="p-0">
							<div style={`height: ${sessionsVirtualPaddingBottom}px`}></div>
						</Table.Cell>
					</Table.Row>
				{/if}
			</Table.Body>
		</Table.Root>
		{#if sessionsLoading}
			<div class="px-3 py-2 text-sm text-muted-foreground">Loading games...</div>
		{/if}
	</ScrollArea.Root>
{/if}
