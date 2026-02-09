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
	import type { PlayerSession } from '$lib/types/openfront';

	type ColumnMeta = { align?: 'right' };

	let {
		playerSessions = [],
		sessionsLoading = false,
		sessionsError = '',
		heightClass = 'h-[60vh]',
		focusSessionKey = null
	} = $props<{
		playerSessions?: PlayerSession[];
		sessionsLoading?: boolean;
		sessionsError?: string;
		heightClass?: string;
		focusSessionKey?: string | null;
	}>();

	const formatDateTime = (value: unknown) => {
		if (!value) return '—';
		const date = new Date(String(value));
		if (Number.isNaN(date.getTime())) return String(value);
		return date.toLocaleString();
	};

	const rawValues = {
		game: (session: PlayerSession) => session.gameId,
		start: (session: PlayerSession) => session.gameStart,
		end: (session: PlayerSession) => session.gameEnd,
		result: (session: PlayerSession) =>
			typeof session.hasWon === 'boolean' ? (session.hasWon ? 'Win' : 'Loss') : '—',
		type: (session: PlayerSession) => session.gameType,
		mode: (session: PlayerSession) => session.gameMode,
		username: (session: PlayerSession) => session.username,
		clanTag: (session: PlayerSession) => session.clanTag,
		clientId: (session: PlayerSession) => session.clientId
	} as const;

	const getSessionKey = (session: PlayerSession) =>
		[
			String(rawValues.game(session) ?? ''),
			String(rawValues.clientId(session) ?? ''),
			String(rawValues.start(session) ?? '')
		].join(':');

	const getGameUrl = (session: PlayerSession) => {
		const value = rawValues.game(session);
		if (value === null || value === undefined || value === '') return null;
		return `https://openfront.io/game/${encodeURIComponent(String(value))}`;
	};

	const sortValue = {
		game: (session: PlayerSession) => {
			const value = rawValues.game(session);
			return value ? String(value).toLowerCase() : null;
		},
		start: (session: PlayerSession) => {
			const value = rawValues.start(session);
			if (!value) return null;
			const timestamp = Date.parse(String(value));
			return Number.isNaN(timestamp) ? null : timestamp;
		},
		end: (session: PlayerSession) => {
			const value = rawValues.end(session);
			if (!value) return null;
			const timestamp = Date.parse(String(value));
			return Number.isNaN(timestamp) ? null : timestamp;
		},
		result: (session: PlayerSession) => rawValues.result(session),
		type: (session: PlayerSession) => rawValues.type(session),
		mode: (session: PlayerSession) => rawValues.mode(session),
		username: (session: PlayerSession) => rawValues.username(session),
		clanTag: (session: PlayerSession) => rawValues.clanTag(session),
		clientId: (session: PlayerSession) => rawValues.clientId(session)
	} as const;

	const compareNullable = (left: unknown, right: unknown) => {
		if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
		if (right === null || right === undefined) return -1;
		if (typeof left === 'number' && typeof right === 'number') return left - right;
		return String(left).localeCompare(String(right));
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
		game: playerSessions.some((session: PlayerSession) => Boolean(rawValues.game(session))),
		start: playerSessions.some((session: PlayerSession) => Boolean(rawValues.start(session))),
		end: playerSessions.some((session: PlayerSession) => Boolean(rawValues.end(session))),
		result: playerSessions.some(
			(session: PlayerSession) => typeof session.hasWon === 'boolean'
		),
		type: playerSessions.some((session: PlayerSession) => Boolean(rawValues.type(session))),
		mode: playerSessions.some((session: PlayerSession) => Boolean(rawValues.mode(session))),
		username: playerSessions.some((session: PlayerSession) => Boolean(rawValues.username(session))),
		clanTag: playerSessions.some((session: PlayerSession) => Boolean(rawValues.clanTag(session))),
		clientId: playerSessions.some((session: PlayerSession) => Boolean(rawValues.clientId(session)))
	}));

	const columns: ColumnDef<PlayerSession, unknown>[] = [
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
			id: 'type',
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: 'Type',
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted()
				}),
			accessorFn: (session) => sortValue.type(session),
			sortingFn: makeSortingFn(),
			cell: ({ row }) => String(rawValues.type(row.original) ?? '—')
		},
		{
			id: 'mode',
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: 'Mode',
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted()
				}),
			accessorFn: (session) => sortValue.mode(session),
			sortingFn: makeSortingFn(),
			cell: ({ row }) => String(rawValues.mode(row.original) ?? '—')
		},
		{
			id: 'username',
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: 'Username',
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted()
				}),
			accessorFn: (session) => sortValue.username(session),
			sortingFn: makeSortingFn(),
			cell: ({ row }) => String(rawValues.username(row.original) ?? '—')
		},
		{
			id: 'clanTag',
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: 'Clan',
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted()
				}),
			accessorFn: (session) => sortValue.clanTag(session),
			sortingFn: makeSortingFn(),
			cell: ({ row }) => String(rawValues.clanTag(row.original) ?? '—')
		},
		{
			id: 'clientId',
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: 'Client',
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted()
				}),
			accessorFn: (session) => sortValue.clientId(session),
			sortingFn: makeSortingFn(),
			cell: ({ row }) => String(rawValues.clientId(row.original) ?? '—'),
			meta: { align: 'right' } satisfies ColumnMeta
		}
	];

	const table = createSvelteTable({
		get data() {
			return playerSessions;
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
		count: 0,
		getScrollElement: () => sessionsViewport,
		estimateSize: () => estimatedRowHeight,
		overscan: 6,
		paddingStart: 0,
		getItemKey: (index) => index
	});

	const measureRow = (node: HTMLTableRowElement) => {
		$rowVirtualizer.measureElement(node);
	};

	$effect(() => {
		const viewport = sessionsViewport;
		const rows = tableRows;
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
{:else if sessionsLoading && playerSessions.length === 0}
	<div class="grid gap-3">
		{#each Array.from({ length: 5 }, (_, idx) => idx) as idx (idx)}
			<Skeleton.Root class="h-10 w-full" />
		{/each}
	</div>
{:else if playerSessions.length === 0}
	<Empty.Root class="border-muted-foreground/30">
		<h3 class="text-lg font-semibold">No games found</h3>
		<p class="text-sm text-muted-foreground">
			This player has no recent public games in the API range.
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
