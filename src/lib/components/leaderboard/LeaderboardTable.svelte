<script lang="ts">
	import {
		type ColumnDef,
		type ColumnFiltersState,
		type SortingState,
		getCoreRowModel,
		getFilteredRowModel,
		getSortedRowModel,
	} from "@tanstack/table-core";
	import * as Card from "$lib/components/ui/card";
	import * as Table from "$lib/components/ui/table";
	import * as Skeleton from "$lib/components/ui/skeleton";
	import * as Empty from "$lib/components/ui/empty";
	import * as Alert from "$lib/components/ui/alert";
	import { createSvelteTable, FlexRender, renderComponent } from "$lib/components/ui/data-table";
	import type { ClanLeaderboardEntry } from "$lib/types/openfront";
	import DataTableSortHeader from "./DataTableSortHeader.svelte";
	import LeaderboardRankCell from "./LeaderboardRankCell.svelte";
	import LeaderboardClanCell from "./LeaderboardClanCell.svelte";

	type ColumnMeta = {
		align?: "center" | "right";
	};

	let {
		isLoading = false,
		errorMessage = "",
		entries = [],
		search = "",
		rankLookup,
		rankImages = [],
		rankAccentColors = [],
		formatNumber,
		formatRatio,
		formatPercent,
		getWinRate,
		openClanDialog,
	} = $props<{
		isLoading?: boolean;
		errorMessage?: string;
		entries?: ClanLeaderboardEntry[];
		search?: string;
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
	let columnFilters = $state<ColumnFiltersState>([]);
	const columns: ColumnDef<ClanLeaderboardEntry, unknown>[] = [
		{
			id: "rank",
			header: "Rank",
			enableSorting: false,
			meta: { align: "center" } satisfies ColumnMeta,
			cell: ({ row }) => {
				const originalRank =
					rankLookup.get(String(row.original.clanTag ?? "")) ?? row.index + 1;
				return renderComponent(LeaderboardRankCell, {
					rank: originalRank,
					rankImage: originalRank <= 3 ? rankImages[originalRank - 1] : null,
					rankAccent: originalRank <= 3 ? rankAccentColors[originalRank - 1] : null,
				});
			},
		},
		{
			accessorKey: "clanTag",
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: "Clan",
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted(),
				}),
			cell: ({ row }) => {
				const originalRank =
					rankLookup.get(String(row.original.clanTag ?? "")) ?? row.index + 1;
				return renderComponent(LeaderboardClanCell, {
					tag: String(row.original.clanTag ?? "—"),
					isTop: originalRank <= 3,
					rankAccent: originalRank <= 3 ? rankAccentColors[originalRank - 1] : null,
				});
			},
		},
		{
			accessorKey: "weightedWins",
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: "Weighted Wins",
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted(),
				}),
			meta: { align: "right" } satisfies ColumnMeta,
			cell: ({ row }) => formatNumber(row.original.weightedWins),
		},
		{
			accessorKey: "games",
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: "Games",
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted(),
				}),
			meta: { align: "right" } satisfies ColumnMeta,
			cell: ({ row }) => formatNumber(row.original.games),
		},
		{
			accessorKey: "wins",
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: "Wins",
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted(),
				}),
			meta: { align: "right" } satisfies ColumnMeta,
			cell: ({ row }) => formatNumber(row.original.wins),
		},
		{
			accessorKey: "losses",
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: "Losses",
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted(),
				}),
			meta: { align: "right" } satisfies ColumnMeta,
			cell: ({ row }) => formatNumber(row.original.losses),
		},
		{
			accessorKey: "weightedWLRatio",
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: "W/L Ratio",
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted(),
				}),
			meta: { align: "right" } satisfies ColumnMeta,
			cell: ({ row }) => formatRatio(row.original.weightedWLRatio),
		},
		{
			id: "winRate",
			accessorFn: (entry) => getWinRate(entry),
			header: ({ column }) =>
				renderComponent(DataTableSortHeader, {
					label: "Win Rate",
					onClick: column.getToggleSortingHandler(),
					isSorted: column.getIsSorted(),
				}),
			meta: { align: "right" } satisfies ColumnMeta,
			cell: ({ row }) => formatPercent(getWinRate(row.original)),
		},
	];

	$effect(() => {
		columnFilters = search
			? [
					{
						id: "clanTag",
						value: search,
					},
				]
			: [];
	});


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
			},
		},
		onSortingChange: (updater) => {
			if (typeof updater === "function") {
				sorting = updater(sorting);
			} else {
				sorting = updater;
			}
		},
		onColumnFiltersChange: (updater) => {
			if (typeof updater === "function") {
				columnFilters = updater(columnFilters);
			} else {
				columnFilters = updater;
			}
		},
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});
</script>

<Card.Root class="gap-4">
	<Card.Header>
		<Card.Title class="text-xl">Leaderboard</Card.Title>
		<Card.Description>Click a clan row to view stats and recent sessions.</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if errorMessage}
			<Alert.Root variant="destructive">
				<Alert.Title>Something went wrong</Alert.Title>
				<Alert.Description>{errorMessage}</Alert.Description>
			</Alert.Root>
		{:else if isLoading}
			<div class="grid gap-3">
				{#each Array(6) as _, idx (idx)}
					<Skeleton.Root class="h-12 w-full" />
				{/each}
			</div>
		{:else if table.getRowModel().rows.length === 0}
			<Empty.Root class="border-muted-foreground/30">
				<h3 class="text-lg font-semibold">No clans found</h3>
				<p class="text-sm text-muted-foreground">Try a different search or refresh the leaderboard.</p>
			</Empty.Root>
		{:else}
			<Table.Root>
				<Table.Header>
					{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
						<Table.Row>
							{#each headerGroup.headers as header (header.id)}
								{@const meta = header.column.columnDef.meta as ColumnMeta | undefined}
								{@const align = meta?.align}
								<Table.Head
									colspan={header.colSpan}
									class={[
										"border-l border-border/40 first:border-l-0",
										header.column.id === "rank" ? "w-20 text-center" : "",
										align === "right" ? "text-right" : "",
									]
										.filter(Boolean)
										.join(" ")}
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
					{#each table.getRowModel().rows as row (row.id)}
						{@const originalRank =
							rankLookup.get(String(row.original.clanTag ?? "")) ?? row.index + 1}
						<Table.Row
							class={`cursor-pointer hover:bg-muted/60 ${originalRank <= 3 ? "rank-row" : ""}`}
							style={originalRank <= 3 ? `--rank-accent: ${rankAccentColors[originalRank - 1]}` : ""}
							onclick={() => openClanDialog(row.original.clanTag)}
						>
							{#each row.getVisibleCells() as cell (cell.id)}
								{@const meta = cell.column.columnDef.meta as ColumnMeta | undefined}
								{@const align = meta?.align}
								<Table.Cell
									class={[
										"border-l border-border/40 first:border-l-0",
										align === "right" ? "text-right" : "",
										align === "center" ? "text-center" : "",
									]
										.filter(Boolean)
										.join(" ")}
								>
									<FlexRender
										content={cell.column.columnDef.cell}
										context={cell.getContext()}
									/>
								</Table.Cell>
							{/each}
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={columns.length} class="h-24 text-center">
								No clans found.
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		{/if}
	</Card.Content>
</Card.Root>
