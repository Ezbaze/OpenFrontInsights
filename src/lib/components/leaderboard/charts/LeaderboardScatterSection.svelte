<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Chart from '$lib/components/ui/chart';
	import * as Empty from '$lib/components/ui/empty';
	import { ScatterChart } from 'layerchart';
	import type { ClanLeaderboardEntry } from '$lib/types/openfront';
	import XIcon from '@lucide/svelte/icons/x';
	import GraphHelpSheet from '../GraphHelpSheet.svelte';
	import ScatterTooltip from '../ScatterTooltip.svelte';
	import {
		chartPadding,
		createScatterBrush,
		formatNumber,
		formatRatio,
		getDomain,
		helpHeadingClass,
		iconButtonClass,
		yAxisNoNumbers
	} from './chart-utils';

	let { entries = [], onClanFocus } = $props<{
		entries?: ClanLeaderboardEntry[];
		onClanFocus?: (clanTag: string) => void;
	}>();

	let activeScatterMode = $state<'avg' | 'strongActive' | 'strongQuiet' | 'activeStruggle' | null>(
		null
	);
	let scatterZoomX = $state<import('./chart-utils').ChartDomain | null>(null);
	let scatterZoomY = $state<import('./chart-utils').ChartDomain | null>(null);

	const scatterData = $derived.by(() =>
		(entries as ClanLeaderboardEntry[])
			.filter((entry) => Number.isFinite(entry.weightedWLRatio) && Number.isFinite(entry.games))
			.map((entry) => ({
				clanTag: entry.clanTag,
				games: entry.games,
				weightedWLRatio: entry.weightedWLRatio,
				playerSessions: entry.playerSessions
			}))
	);
	const scatterXDomain = $derived.by(() => getDomain(scatterData.map((d) => d.games)));
	const scatterYDomain = $derived.by(() => getDomain(scatterData.map((d) => d.weightedWLRatio)));
	const scatterSummary = $derived.by(() => {
		if (scatterData.length === 0) return null;
		const avgGames = scatterData.reduce((sum, entry) => sum + entry.games, 0) / scatterData.length;
		const avgRatio =
			scatterData.reduce((sum, entry) => sum + entry.weightedWLRatio, 0) / scatterData.length;
		const strongAndActive = scatterData.filter(
			(entry) => entry.games >= avgGames && entry.weightedWLRatio >= avgRatio
		).length;
		const activeButStruggling = scatterData.filter(
			(entry) => entry.games >= avgGames && entry.weightedWLRatio < avgRatio
		).length;
		const strongButQuiet = scatterData.filter(
			(entry) => entry.games < avgGames && entry.weightedWLRatio >= avgRatio
		).length;
		return {
			avgGames,
			avgRatio,
			strongAndActive,
			activeButStruggling,
			strongButQuiet,
			total: scatterData.length
		};
	});

	const scatterConfig = {
		clans: {
			label: 'Clans',
			color: 'var(--chart-5)'
		}
	} satisfies Chart.ChartConfig;
</script>

<Card.Root class="group lg:col-span-2">
	{#snippet scatterChart()}
		{#if scatterData.length === 0}
			<Empty.Root class="border-muted-foreground/30">
				<h3 class="text-base font-semibold">No data yet</h3>
				<p class="text-sm text-muted-foreground">Refresh the leaderboard to load clan stats.</p>
			</Empty.Root>
		{:else}
			<Chart.Container config={scatterConfig} class="min-h-[260px] w-full">
				<ScatterChart
					x="games"
					y="weightedWLRatio"
					xDomain={scatterZoomX ?? scatterXDomain}
					yDomain={scatterZoomY ?? scatterYDomain}
					brush={createScatterBrush(({ xDomain, yDomain }) => {
						scatterZoomX = xDomain;
						scatterZoomY = yDomain;
					})}
					r="playerSessions"
					rRange={[3, 12]}
					padding={chartPadding}
					highlight={false}
					onTooltipClick={(_, detail) => {
						const tag = (detail?.data as { clanTag?: string })?.clanTag;
						if (tag) onClanFocus?.(String(tag));
					}}
					series={[
						{
							key: 'clans',
							label: scatterConfig.clans.label,
							color: scatterConfig.clans.color,
							data: scatterData
						}
					]}
					props={{
						yAxis: { ...yAxisNoNumbers },
						points: { class: 'cursor-pointer' }
					}}
				>
					{#snippet aboveMarks({ context })}
						{#if scatterSummary && activeScatterMode}
							{@const xMin = Math.min(...context.xRange)}
							{@const xMax = Math.max(...context.xRange)}
							{@const yMin = Math.min(...context.yRange)}
							{@const yMax = Math.max(...context.yRange)}
							{@const xAvg = context.xScale(scatterSummary.avgGames)}
							{@const yAvg = context.yScale(scatterSummary.avgRatio)}
							{#if Number.isFinite(xAvg) && Number.isFinite(yAvg)}
								{#if activeScatterMode === 'avg'}
									<line
										x1={xAvg}
										x2={xAvg}
										y1={yMin}
										y2={yMax}
										class="stroke-foreground/60"
										stroke-dasharray="4 4"
										stroke-width="1"
										opacity="0.9"
										pointer-events="none"
									/>
									<line
										x1={xMin}
										x2={xMax}
										y1={yAvg}
										y2={yAvg}
										class="stroke-foreground/60"
										stroke-dasharray="4 4"
										stroke-width="1"
										opacity="0.9"
										pointer-events="none"
									/>
								{:else if activeScatterMode === 'strongActive'}
									<rect
										x={xAvg}
										y={yMin}
										width={Math.max(0, xMax - xAvg)}
										height={Math.max(0, yAvg - yMin)}
										class="fill-foreground/5 stroke-foreground/30"
										stroke-dasharray="4 4"
										stroke-width="1"
										opacity="0.9"
										pointer-events="none"
									/>
								{:else if activeScatterMode === 'strongQuiet'}
									<rect
										x={xMin}
										y={yMin}
										width={Math.max(0, xAvg - xMin)}
										height={Math.max(0, yAvg - yMin)}
										class="fill-foreground/5 stroke-foreground/30"
										stroke-dasharray="4 4"
										stroke-width="1"
										opacity="0.9"
										pointer-events="none"
									/>
								{:else if activeScatterMode === 'activeStruggle'}
									<rect
										x={xAvg}
										y={yAvg}
										width={Math.max(0, xMax - xAvg)}
										height={Math.max(0, yMax - yAvg)}
										class="fill-foreground/5 stroke-foreground/30"
										stroke-dasharray="4 4"
										stroke-width="1"
										opacity="0.9"
										pointer-events="none"
									/>
								{/if}
							{/if}
						{/if}
					{/snippet}
					{#snippet tooltip()}
						<ScatterTooltip
							title={(data) => (data as { clanTag?: string }).clanTag ?? null}
							meta={(data) => (data as { games?: number }).games ?? null}
							metaLabelText="Games"
							actionLabel={(data) => (data as { clanTag?: string }).clanTag ?? null}
							actionLabelText="Open clan"
							onAction={(data) => {
								const tag = (data as { clanTag?: string }).clanTag;
								if (tag) onClanFocus?.(String(tag));
							}}
							rows={[
								{
									label: 'Weighted W/L',
									value: (data) =>
										formatRatio((data as { weightedWLRatio?: number }).weightedWLRatio)
								},
								{
									label: 'Player sessions',
									value: (data) =>
										formatNumber((data as { playerSessions?: number }).playerSessions)
								}
							]}
						/>
					{/snippet}
				</ScatterChart>
			</Chart.Container>
		{/if}
	{/snippet}
	{#snippet scatterSection({ showHelp }: { showHelp: boolean })}
		<Card.Header class="flex items-start justify-between gap-3">
			<div>
				<Card.Title class="text-lg">Weighted W/L ratio vs games</Card.Title>
				<Card.Description>Bubble size reflects player sessions.</Card.Description>
			</div>
			{#if showHelp || scatterZoomX !== null || scatterZoomY !== null}
				<div
					class="pointer-events-none flex items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
				>
					{#if scatterZoomX !== null || scatterZoomY !== null}
						<button
							type="button"
							class={iconButtonClass}
							aria-label="Clear zoom"
							onclick={() => {
								scatterZoomX = null;
								scatterZoomY = null;
							}}
						>
							<XIcon class="h-4 w-4" />
						</button>
					{/if}
					{#if showHelp}
						<GraphHelpSheet
							title="Weighted W/L ratio vs games"
							preview={scatterPreview as import('svelte').Snippet<[]>}
							class={iconButtonClass}
						>
							<p class={helpHeadingClass}>How to read</p>
							<p>
								Each dot is a clan. Right means more games played, up means a stronger weighted
								win/loss ratio. Bigger dots mean more player sessions.
							</p>
							<p>
								This combines activity and performance so you can spot “strong and active” clans
								quickly.
							</p>
							<ul class="list-disc pl-4">
								<li>Top-right is the sweet spot: strong and active.</li>
								<li>Bottom-right means active but struggling.</li>
							</ul>
							{#if scatterSummary}
								<p class={`${helpHeadingClass} mt-3`}>What this data says</p>
								<p>
									<button
										type="button"
										class="cursor-pointer"
										onmouseenter={() => (activeScatterMode = 'avg')}
										onmouseleave={() => (activeScatterMode = null)}
										onfocus={() => (activeScatterMode = 'avg')}
										onblur={() => (activeScatterMode = null)}
									>
										Average clan here plays about
										<span
											class="font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
										>
											{formatNumber(scatterSummary.avgGames)}
										</span>
										games with a weighted W/L of
										<span
											class="font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
										>
											{formatRatio(scatterSummary.avgRatio)}
										</span>
										.
									</button>
									There are
									<button
										type="button"
										class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
										onmouseenter={() => (activeScatterMode = 'strongActive')}
										onmouseleave={() => (activeScatterMode = null)}
										onfocus={() => (activeScatterMode = 'strongActive')}
										onblur={() => (activeScatterMode = null)}
									>
										{formatNumber(scatterSummary.strongAndActive)}
									</button>
									of {formatNumber(scatterSummary.total)} clans above both averages.
								</p>
								<p>
									<button
										type="button"
										class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
										onmouseenter={() => (activeScatterMode = 'strongQuiet')}
										onmouseleave={() => (activeScatterMode = null)}
										onfocus={() => (activeScatterMode = 'strongQuiet')}
										onblur={() => (activeScatterMode = null)}
									>
										{formatNumber(scatterSummary.strongButQuiet)}
									</button>
									clans are strong but less active, while
									<button
										type="button"
										class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
										onmouseenter={() => (activeScatterMode = 'activeStruggle')}
										onmouseleave={() => (activeScatterMode = null)}
										onfocus={() => (activeScatterMode = 'activeStruggle')}
										onblur={() => (activeScatterMode = null)}
									>
										{formatNumber(scatterSummary.activeButStruggling)}
									</button>
									are active but below-average on weighted W/L.
								</p>
							{/if}
						</GraphHelpSheet>
					{/if}
				</div>
			{/if}
		</Card.Header>
		<Card.Content>
			{@render (scatterChart as import('svelte').Snippet<[]>)()}
		</Card.Content>
	{/snippet}
	{#snippet scatterPreview()}
		{@render (scatterSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
			showHelp: false
		})}
	{/snippet}
	{@render (scatterSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
		showHelp: true
	})}
</Card.Root>
