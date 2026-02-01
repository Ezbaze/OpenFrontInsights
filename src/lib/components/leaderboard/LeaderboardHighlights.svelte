<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Skeleton from '$lib/components/ui/skeleton';
	import * as Empty from '$lib/components/ui/empty';
	import { Badge } from '$lib/components/ui/badge';
	import type { ClanLeaderboardEntry } from '$lib/types/openfront';

	let {
		isLoading = false,
		topEntries = [],
		rankImages = [],
		rankAccentColors = [],
		formatNumber,
		formatRatio,
		formatPercent,
		getWinRate
	} = $props<{
		isLoading?: boolean;
		topEntries?: ClanLeaderboardEntry[];
		rankImages?: string[];
		rankAccentColors?: string[];
		formatNumber: (value: number | null | undefined) => string;
		formatRatio: (value: number | null | undefined) => string;
		formatPercent: (value: number) => string;
		getWinRate: (entry: ClanLeaderboardEntry) => number;
	}>();
</script>

<section class="mt-0 grid gap-4 lg:grid-cols-3">
	{#if isLoading}
		{#each Array.from({ length: 3 }, (_, idx) => idx) as idx (idx)}
			<Card.Root>
				<Card.Header>
					<Skeleton.Root class="h-6 w-24" />
					<Skeleton.Root class="h-4 w-32" />
				</Card.Header>
				<Card.Content class="space-y-3">
					<Skeleton.Root class="h-8 w-full" />
					<Skeleton.Root class="h-4 w-2/3" />
				</Card.Content>
			</Card.Root>
		{/each}
	{:else if topEntries.length === 0}
		<Card.Root class="lg:col-span-3">
			<Card.Content>
				<Empty.Root class="border-muted-foreground/30">
					<h3 class="text-lg font-semibold">No clans to highlight</h3>
					<p class="text-sm text-muted-foreground">
						Adjust filters or refresh to see leaderboard highlights.
					</p>
				</Empty.Root>
			</Card.Content>
		</Card.Root>
	{:else}
		{#each topEntries as clan, index (clan.clanTag)}
			<Card.Root
				class="rank-card relative overflow-visible"
				style={`--rank-accent: ${rankAccentColors[index] ?? '0 0 0'}`}
			>
				<div class="rank-card-glow" aria-hidden="true"></div>
				{#if rankImages[index]}
					<img
						src={rankImages[index]}
						alt={`Rank ${index + 1} accent`}
						class="rank-accent pointer-events-none absolute top-0 left-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2"
						loading="lazy"
					/>
				{/if}
				<Card.Header class="gap-2">
					<div class="flex items-center justify-between">
						<Badge
							variant={index === 0 ? 'default' : 'secondary'}
							style={`--rank-accent: ${rankAccentColors[index] ?? '0 0 0'}`}
							class="rank-badge"
						>
							#{index + 1}
						</Badge>
						<Badge
							variant="outline"
							style={`--rank-accent: ${rankAccentColors[index] ?? '0 0 0'}`}
							class="rank-tag"
						>
							{clan.clanTag}
						</Badge>
					</div>
					<Card.Title class="text-lg">{formatNumber(clan.weightedWins)} weighted wins</Card.Title>
					<Card.Description>Weighted W/L: {formatRatio(clan.weightedWLRatio)}</Card.Description>
				</Card.Header>
				<Card.Content class="grid gap-2 text-sm">
					<div class="flex items-center justify-between">
						<span class="text-muted-foreground">Games</span>
						<span class="font-medium">{formatNumber(clan.games)}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-muted-foreground">Wins</span>
						<span class="font-medium">{formatNumber(clan.wins)}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-muted-foreground">Losses</span>
						<span class="font-medium">{formatNumber(clan.losses)}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-muted-foreground">Win rate</span>
						<span class="font-medium">{formatPercent(getWinRate(clan))}</span>
					</div>
				</Card.Content>
			</Card.Root>
		{/each}
	{/if}
</section>
