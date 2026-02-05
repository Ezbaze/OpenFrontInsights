<script lang="ts">
	import {
		type ColumnDef,
		type ColumnFiltersState,
		type SortingState,
		getCoreRowModel,
		getFilteredRowModel,
		getSortedRowModel
	} from '@tanstack/table-core';
	import { createVirtualizer } from '@tanstack/svelte-virtual';
	import * as Card from '$lib/components/ui/card';
	import * as Input from '$lib/components/ui/input';
	import * as ScrollArea from '$lib/components/ui/scroll-area';
	import * as Table from '$lib/components/ui/table';
	import * as Skeleton from '$lib/components/ui/skeleton';
	import * as Empty from '$lib/components/ui/empty';
	import * as Alert from '$lib/components/ui/alert';
	import { get } from 'svelte/store';
	import { createSvelteTable, FlexRender, renderComponent } from '$lib/components/ui/data-table';
	import type { ClanLeaderboardEntry } from '$lib/types/openfront';
	import DataTableSortHeader from './DataTableSortHeader.svelte';
	import LeaderboardRankCell from './LeaderboardRankCell.svelte';
	import LeaderboardClanCell from './LeaderboardClanCell.svelte';

	type ColumnMeta = {
		align?: 'center' | 'right';
	};

	let {
		isLoading = false,
		errorMessage = '',
		entries = [],
		focusClanTag = null,
		rankLookup,
		rankImages = [],
		rankAccentColors = [],
		formatNumber,
		formatRatio,
		formatPercent,
		getWinRate,
		openClanDialog
	} = $props<{
		isLoading?: boolean;
		errorMessage?: string;
		entries?: ClanLeaderboardEntry[];
		focusClanTag?: string | null;
		rankLookup: Map<string, number>;
		rankImages?: string[];
		rankAccentColors?: string[];
		formatNumber: (value: number | null | undefined) => string;
		formatRatio: (value: number | null | undefined) => string;
		formatPercent: (value: number) => string;
		getWinRate: (entry: ClanLeaderboardEntry) => number;
		openClanDialog: (clanTag: string) => void;
	}>();

	let sorting = $state<SortingState>([]);
	let tableSearch = $state('');
	const normalizedSearch = $derived.by(() => tableSearch.trim());
	const columnFilters = $derived.by<ColumnFiltersState>(() =>
		normalizedSearch
			? [
					{
						id: 'clanTag',
						value: normalizedSearch
					}
				]
			: []
	);
	const columns: ColumnDef<ClanLeaderboardEntry, unknown>[] = [
		{
			id: 'rank',
			header: 'Rank',
			enableSorting: false,
			meta: { align: 'center' } satisfies ColumnMeta,
			cell: ({ row }) => {
				const originalRank = rankLookup.get(String(row.original.clanTag ?? '')) ?? row.index + 1;
				return renderComponent(LeaderboardRankCell, {
					rank: originalRank,
					rankImage: originalRank <= 3 ? rankImages[originalRank - 1] : null,
					rankAccent: originalRank <= 3 ? rankAccentColors[originalRank - 1] : null
				});
			}
		},
		{
			accessorKey: 'clanTag',
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: 'Clan',
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted()
				}),
			cell: ({ row }) => {
				const originalRank = rankLookup.get(String(row.original.clanTag ?? '')) ?? row.index + 1;
				return renderComponent(LeaderboardClanCell, {
					tag: String(row.original.clanTag ?? '—'),
					isTop: originalRank <= 3,
					rankAccent: originalRank <= 3 ? rankAccentColors[originalRank - 1] : null
				});
			}
		},
		{
			accessorKey: 'weightedWins',
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: 'Weighted Wins',
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted()
				}),
			meta: { align: 'right' } satisfies ColumnMeta,
			cell: ({ row }) => formatNumber(row.original.weightedWins)
		},
		{
			accessorKey: 'games',
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: 'Games',
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted()
				}),
			meta: { align: 'right' } satisfies ColumnMeta,
			cell: ({ row }) => formatNumber(row.original.games)
		},
		{
			accessorKey: 'wins',
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: 'Wins',
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted()
				}),
			meta: { align: 'right' } satisfies ColumnMeta,
			cell: ({ row }) => formatNumber(row.original.wins)
		},
		{
			accessorKey: 'losses',
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: 'Losses',
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted()
				}),
			meta: { align: 'right' } satisfies ColumnMeta,
			cell: ({ row }) => formatNumber(row.original.losses)
		},
		{
			accessorKey: 'weightedWLRatio',
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: 'W/L Ratio',
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted()
				}),
			meta: { align: 'right' } satisfies ColumnMeta,
			cell: ({ row }) => formatRatio(row.original.weightedWLRatio)
		},
		{
			id: 'winRate',
			accessorFn: (entry) => getWinRate(entry),
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: 'Win Rate',
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted()
				}),
			meta: { align: 'right' } satisfies ColumnMeta,
			cell: ({ row }) => formatPercent(getWinRate(row.original))
		}
	];

	const table = createSvelteTable({
		get data() {
			return entries;
		},
		columns,
		state: {
			get sorting() {
				return sorting;
			},
			get columnFilters() {
				return columnFilters;
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
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel()
	});

	const tableRows = $derived.by(() => table.getRowModel().rows);
	const focusClanTagNormalized = $derived.by(() =>
		focusClanTag ? String(focusClanTag).toLowerCase() : null
	);

	let tableViewport = $state<HTMLElement | null>(null);
	let tableHeaderEl = $state<HTMLTableSectionElement | null>(null);
	const headerHeight = $derived.by(() => tableHeaderEl?.clientHeight ?? 0);

	const estimatedRowHeight = 44;
	const rowVirtualizer = createVirtualizer<HTMLElement, HTMLTableRowElement>({
		count: 0,
		getScrollElement: () => tableViewport,
		estimateSize: () => estimatedRowHeight,
		overscan: 8,
		paddingStart: 0,
		getItemKey: (index) => index
	});

	const measureRow = (node: HTMLTableRowElement) => {
		$rowVirtualizer.measureElement(node);
	};

	$effect(() => {
		const rows = tableRows;
		const viewport = tableViewport;
		$rowVirtualizer.setOptions({
			count: rows.length,
			getScrollElement: () => viewport,
			paddingStart: headerHeight,
			getItemKey: (index) => rows[index]?.id ?? index
		});
	});

	$effect(() => {
		const target = focusClanTagNormalized;
		const viewport = tableViewport;
		if (!target || !viewport) return;
		const rows = tableRows;
		const targetIndex = rows.findIndex(
			(row) => String(row.original.clanTag ?? '').toLowerCase() === target
		);
		if (targetIndex < 0) return;
		get(rowVirtualizer).scrollToIndex(targetIndex, { align: 'center' });
	});

	const virtualRows = $derived.by(() => $rowVirtualizer.getVirtualItems());
	const virtualPaddingTop = $derived.by(() => {
		if (virtualRows.length === 0) return 0;
		return Math.max(0, virtualRows[0].start - headerHeight);
	});
	const virtualPaddingBottom = $derived.by(() => {
		if (virtualRows.length === 0) return 0;
		const totalSize = $rowVirtualizer.getTotalSize();
		return Math.max(0, totalSize - virtualRows[virtualRows.length - 1].end);
	});
</script>

<Card.Root class="gap-4">
	<Card.Header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
		<div class="space-y-1">
			<Card.Title class="text-xl">Leaderboard</Card.Title>
			<Card.Description>Click a clan row to view full clan details.</Card.Description>
		</div>
		<div class="w-full sm:w-64 sm:self-start">
			<Input.Root
				id="leaderboard-filter"
				type="text"
				autocomplete="off"
				placeholder="Filter leaderboard"
				aria-label="Filter leaderboard"
				bind:value={tableSearch}
			/>
		</div>
	</Card.Header>
	<Card.Content>
		{#if errorMessage}
			<Alert.Root variant="destructive">
				<Alert.Title>Something went wrong</Alert.Title>
				<Alert.Description>{errorMessage}</Alert.Description>
			</Alert.Root>
		{:else if isLoading}
			<div class="grid gap-3">
				{#each Array.from({ length: 6 }, (_, idx) => idx) as idx (idx)}
					<Skeleton.Root class="h-12 w-full" />
				{/each}
			</div>
		{:else if tableRows.length === 0}
			<Empty.Root class="border-muted-foreground/30">
				<h3 class="text-lg font-semibold">No clans found</h3>
				<p class="text-sm text-muted-foreground">
					Try a different search or refresh the leaderboard.
				</p>
			</Empty.Root>
		{:else}
			<ScrollArea.Root
				class="h-[70vh] w-full [&_[data-slot='scroll-area-viewport']]:[scrollbar-gutter:stable_both-edges] [&_[data-slot='table-container']]:overflow-visible"
				orientation="both"
				scrollbarXClasses="z-20"
				scrollbarYClasses="z-20"
				bind:viewportRef={tableViewport}
			>
				<Table.Root class="min-w-full table-fixed">
					<Table.Header bind:ref={tableHeaderEl} class="bg-card">
						{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
							<Table.Row class="hover:[&,&>svelte-css-wrapper]:[&>th,td]:!bg-card">
								{#each headerGroup.headers as header (header.id)}
									{@const meta = header.column.columnDef.meta as ColumnMeta | undefined}
									{@const align = meta?.align}
									<Table.Head
										colspan={header.colSpan}
										class={[
											'sticky top-0 z-10 border-l border-border/40 bg-card first:border-l-0',
											header.column.id === 'rank' ? 'w-20 text-center' : '',
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
						{#if virtualPaddingTop > 0}
							<Table.Row>
								<Table.Cell colspan={Math.max(1, table.getVisibleLeafColumns().length)} class="p-0">
									<div style={`height: ${virtualPaddingTop}px`}></div>
								</Table.Cell>
							</Table.Row>
						{/if}
						{#each virtualRows as virtualRow (tableRows[virtualRow.index]?.id ?? virtualRow.key)}
							{@const row = tableRows[virtualRow.index]}
							{#if row}
								{@const originalRank =
									rankLookup.get(String(row.original.clanTag ?? '')) ?? row.index + 1}
								{@const isFocused =
									focusClanTagNormalized &&
									String(row.original.clanTag ?? '').toLowerCase() === focusClanTagNormalized}
								<tr
									data-slot="table-row"
									data-index={virtualRow.index}
									use:measureRow
									class={`cursor-pointer border-b transition-colors hover:bg-muted/60 data-[state=selected]:bg-muted hover:[&,&>svelte-css-wrapper]:[&>th,td]:bg-muted/50 ${isFocused ? 'bg-muted/40 outline outline-1 outline-border/60' : ''} ${originalRank <= 3 ? 'bg-[linear-gradient(90deg,_rgb(var(--rank-accent)/0.12)_0%,_rgb(var(--rank-accent)/0.05)_18%,_transparent_55%)] shadow-[inset_3px_0_0_rgb(var(--rank-accent)/0.9)]' : ''}`}
									style={originalRank <= 3
										? `--rank-accent: ${rankAccentColors[originalRank - 1]}`
										: ''}
									onclick={() => openClanDialog(row.original.clanTag)}
								>
									{#each row.getVisibleCells() as cell (cell.id)}
										{@const meta = cell.column.columnDef.meta as ColumnMeta | undefined}
										{@const align = meta?.align}
										<Table.Cell
											class={[
												'border-l border-border/40 first:border-l-0',
												align === 'right' ? 'text-right' : '',
												align === 'center' ? 'text-center' : ''
											]
												.filter(Boolean)
												.join(' ')}
										>
											<FlexRender
												content={cell.column.columnDef.cell}
												context={cell.getContext()}
											/>
										</Table.Cell>
									{/each}
								</tr>
							{/if}
						{/each}
						{#if virtualPaddingBottom > 0}
							<Table.Row>
								<Table.Cell colspan={Math.max(1, table.getVisibleLeafColumns().length)} class="p-0">
									<div style={`height: ${virtualPaddingBottom}px`}></div>
								</Table.Cell>
							</Table.Row>
						{/if}
					</Table.Body>
				</Table.Root>
			</ScrollArea.Root>
		{/if}
	</Card.Content>
</Card.Root>
