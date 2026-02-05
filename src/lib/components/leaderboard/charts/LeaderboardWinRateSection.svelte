<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Chart from '$lib/components/ui/chart';
	import * as Empty from '$lib/components/ui/empty';
	import { Bar, BarChart } from 'layerchart';
	import type { ClanLeaderboardEntry } from '$lib/types/openfront';
	import GraphHelpSheet from '../GraphHelpSheet.svelte';
	import {
		chartPadding,
		formatNumber,
		formatPercent,
		helpHeadingClass,
		iconButtonClass,
		safeDivide,
		yAxisNoNumbers
	} from './chart-utils';

	let { entries = [] } = $props<{
		entries?: ClanLeaderboardEntry[];
	}>();

	const hasEntries = $derived.by(() => entries.length > 0);
	let activeWinRateBucket = $state<string | null>(null);

	const winRateBuckets = $derived.by(() => {
		const bucketSize = 10;
		const buckets = Array.from({ length: 10 }, (_, index) => ({
			bucket: `${index * bucketSize}-${(index + 1) * bucketSize}%`,
			count: 0,
			start: index * bucketSize
		}));

		for (const entry of entries) {
			const total = entry.wins + entry.losses;
			if (total <= 0) continue;
			const percent = (entry.wins / total) * 100;
			const bucketIndex = Math.min(9, Math.floor(percent / bucketSize));
			buckets[bucketIndex].count += 1;
		}

		return buckets;
	});
	const winRatePeak = $derived.by(() => {
		if (!hasEntries) return null;
		return winRateBuckets.reduce(
			(best, bucket) => (bucket.count > best.count ? bucket : best),
			winRateBuckets[0]
		);
	});
	const winRateSummary = $derived.by(() => {
		const entriesWithResults = entries.filter((entry) => entry.wins + entry.losses > 0);
		if (entriesWithResults.length === 0) return null;
		const total = entriesWithResults.length;
		const above50 = entriesWithResults.filter(
			(entry) => (safeDivide(entry.wins, entry.wins + entry.losses) ?? 0) >= 0.5
		).length;
		const above60 = entriesWithResults.filter(
			(entry) => (safeDivide(entry.wins, entry.wins + entry.losses) ?? 0) >= 0.6
		).length;
		const below40 = entriesWithResults.filter(
			(entry) => (safeDivide(entry.wins, entry.wins + entry.losses) ?? 1) < 0.4
		).length;
		return { total, above50, above60, below40 };
	});

	const winRateConfig = {
		count: {
			label: 'Clans',
			color: 'var(--chart-1)'
		}
	} satisfies Chart.ChartConfig;
</script>

<Card.Root class="group">
	{#snippet winRateChart()}
		{#if !hasEntries}
			<Empty.Root class="border-muted-foreground/30">
				<h3 class="text-base font-semibold">No data yet</h3>
				<p class="text-sm text-muted-foreground">Refresh the leaderboard to load clan stats.</p>
			</Empty.Root>
		{:else}
			<Chart.Container config={winRateConfig} class="min-h-[220px] w-full">
				<BarChart
					data={winRateBuckets}
					x="bucket"
					bandPadding={0.2}
					padding={chartPadding}
					series={[
						{
							key: 'count',
							label: winRateConfig.count.label,
							color: winRateConfig.count.color
						}
					]}
					props={{
						bars: { stroke: 'none' },
						xAxis: {
							format: (value) => String(value).replace('%', '')
						},
						yAxis: { ...yAxisNoNumbers }
					}}
				>
					{#snippet marks({ context, visibleSeries, getBarsProps })}
						{#if visibleSeries.length}
							{@const barProps = getBarsProps(visibleSeries[0], 0)}
							{#each context.flatData as d, i (d.bucket ?? i)}
								{@const isActive = activeWinRateBucket !== null && d.bucket === activeWinRateBucket}
								<Bar
									class="lc-bars-bar"
									data={d}
									x={barProps.x}
									y={barProps.y}
									x1={barProps.x1}
									y1={barProps.y1}
									radius={barProps.radius}
									rounded={barProps.rounded}
									insets={barProps.insets}
									fill={barProps.fill}
									opacity={barProps.opacity ?? 1}
									stroke="none"
									strokeWidth={0}
									style={isActive
										? 'filter: drop-shadow(0 -1px 0 var(--foreground)) drop-shadow(1px 0 0 var(--foreground)) drop-shadow(-1px 0 0 var(--foreground));'
										: undefined}
								/>
							{/each}
						{/if}
					{/snippet}
					{#snippet tooltip()}
						<Chart.Tooltip />
					{/snippet}
				</BarChart>
			</Chart.Container>
		{/if}
	{/snippet}
	{#snippet winRateSection({ showHelp }: { showHelp: boolean })}
		<Card.Header class="flex items-start justify-between gap-3">
			<div>
				<Card.Title class="text-lg">Win-rate distribution</Card.Title>
				<Card.Description>How clans spread across win-rate buckets.</Card.Description>
			</div>
			{#if showHelp}
				<div
					class="pointer-events-none flex items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
				>
					<GraphHelpSheet
						title="Win-rate distribution"
						preview={winRatePreview}
						class={iconButtonClass}
					>
						<p class={helpHeadingClass}>How to read</p>
						<p>
							Each bar is a win-rate bucket (0–10%, 10–20%, etc.). The height shows how many clans
							fall into that range.
						</p>
						<p>This reveals whether the field is balanced or if most clans are strong/weak.</p>
						<ul class="list-disc pl-4">
							<li>Taller bars mean more clans in that range.</li>
							<li>A big middle bar means the field is balanced.</li>
						</ul>
						{#if winRatePeak || winRateSummary}
							<p class={`${helpHeadingClass} mt-3`}>What this data says</p>
							{#if winRatePeak}
								<p>
									Most clans currently sit in the
									<button
										type="button"
										class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
										onmouseenter={() => (activeWinRateBucket = winRatePeak.bucket)}
										onmouseleave={() => (activeWinRateBucket = null)}
										onfocus={() => (activeWinRateBucket = winRatePeak.bucket)}
										onblur={() => (activeWinRateBucket = null)}
									>
										{winRatePeak.bucket}
									</button>
									win-rate bucket ({formatNumber(winRatePeak.count)} clans).
								</p>
							{/if}
							{#if winRateSummary}
								<p>
									{formatPercent((winRateSummary.above50 / winRateSummary.total) * 100)} of clans are at
									or above 50%, and
									{formatPercent((winRateSummary.above60 / winRateSummary.total) * 100)} are above 60%.
								</p>
								<p>
									Only {formatPercent((winRateSummary.below40 / winRateSummary.total) * 100)} of clans
									are below 40%.
								</p>
							{/if}
						{/if}
					</GraphHelpSheet>
				</div>
			{/if}
		</Card.Header>
		<Card.Content>
			{@render winRateChart()}
		</Card.Content>
	{/snippet}
	{#snippet winRatePreview()}
		{@render winRateSection({ showHelp: false })}
	{/snippet}
	{@render winRateSection({ showHelp: true })}
</Card.Root>
