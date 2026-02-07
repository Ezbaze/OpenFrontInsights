<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Chart from '$lib/components/ui/chart';
	import * as Empty from '$lib/components/ui/empty';
	import { BarChart, Highlight, LineChart } from 'layerchart';
	import type { ClanStats, ClanStatsBreakdown } from '$lib/types/openfront';
	import { SvelteMap } from 'svelte/reactivity';
	import GraphHelpSheet from '../GraphHelpSheet.svelte';
	import XIcon from '@lucide/svelte/icons/x';
	import {
		chartPadding,
		createLineBrush,
		formatNumber,
		formatPercent,
		formatRatio,
		helpHeadingClass,
		iconButtonClass,
		roundTo,
		safeDivide,
		yAxisNoNumbers
	} from './chart-utils';

	let { clanStats = null } = $props<{
		clanStats?: ClanStats | null;
	}>();

	let teamCountDomain = $state<import('./chart-utils').ChartDomain | null>(null);
	let teamCountRatioDomain = $state<import('./chart-utils').ChartDomain | null>(null);
	let activeTeamType = $state<string | null>(null);
	let activeTeamCount = $state<number | null>(null);
	let activeTeamCountRatio = $state<number | null>(null);

	const formatTeamType = (value: string) => {
		if (/^\d+$/.test(value)) return `${value} Teams`;
		return value;
	};

	const teamSizeAliases = new SvelteMap([
		['solo', 1],
		['duo', 2],
		['duos', 2],
		['trio', 3],
		['trios', 3],
		['quad', 4],
		['quads', 4],
		['squad', 4],
		['squads', 4],
		['quint', 5],
		['quints', 5],
		['quintet', 5],
		['sext', 6],
		['sexts', 6],
		['sept', 7],
		['septs', 7],
		['oct', 8],
		['octs', 8]
	]);

	const extractTeamSize = (value: string) => {
		const numericMatch = value.match(/\d+/);
		if (numericMatch) {
			const numeric = Number(numericMatch[0]);
			return Number.isFinite(numeric) ? numeric : null;
		}

		const lowered = value.toLowerCase();
		for (const [alias, size] of teamSizeAliases.entries()) {
			if (lowered.includes(alias)) return size;
		}

		return null;
	};

	const teamTypeCategory = (value: string, size: number | null) => {
		if (/team/i.test(value) || /^\d+$/.test(value) || Number.isFinite(size ?? NaN)) {
			if (!/duo|trio|quad|squad|quint|sext|sept|oct/i.test(value)) {
				return 'teams';
			}
		}
		if (size !== null) return 'party';
		return 'other';
	};

	const teamTypeSortKey = (value: string) => {
		const size = extractTeamSize(value);
		const category = teamTypeCategory(value, size);
		const categoryRank = category === 'party' ? 0 : category === 'teams' ? 1 : 2;
		return { size: size ?? Number.POSITIVE_INFINITY, category, categoryRank };
	};

	const teamTypeData = $derived.by(() => {
		if (!clanStats?.teamTypeWL) return [];

		const entries = Object.entries(clanStats.teamTypeWL) as Array<[string, ClanStatsBreakdown]>;
		return entries
			.map(([key, value]) => {
				const sortKey = teamTypeSortKey(key);
				return {
					teamType: formatTeamType(key),
					wins: Number(value?.wl?.[0] ?? 0),
					losses: Number(value?.wl?.[1] ?? 0),
					weightedWins: Number(value?.weightedWL?.[0] ?? 0),
					weightedLosses: Number(value?.weightedWL?.[1] ?? 0),
					rawKey: key,
					sortKey
				};
			})
			.sort((left, right) => {
				if (left.sortKey.categoryRank !== right.sortKey.categoryRank) {
					return left.sortKey.categoryRank - right.sortKey.categoryRank;
				}
				if (left.sortKey.size !== right.sortKey.size) {
					return left.sortKey.size - right.sortKey.size;
				}
				return left.teamType.localeCompare(right.teamType, undefined, {
					numeric: true,
					sensitivity: 'base'
				});
			});
	});
	const activeTeamTypeDatum = $derived.by(() =>
		activeTeamType === null
			? undefined
			: teamTypeData.find((entry) => entry.teamType === activeTeamType)
	);
	const teamTypeSummary = $derived.by(() => {
		if (teamTypeData.length === 0) return null;
		const totals = teamTypeData
			.map((entry) => ({
				...entry,
				total: entry.wins + entry.losses
			}))
			.filter((entry) => entry.total > 0);
		if (totals.length === 0) return null;
		const mostPlayed = totals.reduce((best, entry) => (entry.total > best.total ? entry : best));
		const bestRate = totals.reduce((best, entry) => {
			const entryRate = safeDivide(entry.wins, entry.total) ?? -1;
			const bestRateValue = safeDivide(best.wins, best.total) ?? -1;
			return entryRate > bestRateValue ? entry : best;
		});
		const worstRate = totals.reduce((worst, entry) => {
			const entryRate = safeDivide(entry.wins, entry.total) ?? 2;
			const worstRateValue = safeDivide(worst.wins, worst.total) ?? 2;
			return entryRate < worstRateValue ? entry : worst;
		});
		return { mostPlayed, bestRate, worstRate };
	});

	const teamCountData = $derived.by(() => {
		if (!clanStats?.teamCountWL) return [];

		const entries = Object.entries(clanStats.teamCountWL) as Array<[string, ClanStatsBreakdown]>;
		return entries
			.map(([key, value]) => {
				const teams = Number(key);
				return {
					teams: Number.isFinite(teams) ? teams : 0,
					wins: Number(value?.wl?.[0] ?? 0),
					losses: Number(value?.wl?.[1] ?? 0),
					weightedWins: Number(value?.weightedWL?.[0] ?? 0),
					weightedLosses: Number(value?.weightedWL?.[1] ?? 0)
				};
			})
			.filter((entry) => entry.teams > 0)
			.sort((a, b) => a.teams - b.teams);
	});
	const teamCountSummary = $derived.by(() => {
		if (teamCountData.length === 0) return null;
		const totals = teamCountData
			.map((entry) => ({
				...entry,
				total: entry.wins + entry.losses
			}))
			.filter((entry) => entry.total > 0);
		if (totals.length === 0) return null;
		const mostPlayed = totals.reduce((best, entry) => (entry.total > best.total ? entry : best));
		const bestRate = totals.reduce((best, entry) => {
			const entryRate = safeDivide(entry.wins, entry.total) ?? -1;
			const bestRateValue = safeDivide(best.wins, best.total) ?? -1;
			return entryRate > bestRateValue ? entry : best;
		});
		const worstRate = totals.reduce((worst, entry) => {
			const entryRate = safeDivide(entry.wins, entry.total) ?? 2;
			const worstRateValue = safeDivide(worst.wins, worst.total) ?? 2;
			return entryRate < worstRateValue ? entry : worst;
		});
		return { mostPlayed, bestRate, worstRate };
	});

	const teamCountRatioData = $derived.by(() =>
		teamCountData
			.map((entry) => {
				const rawRatio = entry.losses > 0 ? entry.wins / entry.losses : null;
				const weightedRatio =
					entry.weightedLosses > 0 ? entry.weightedWins / entry.weightedLosses : null;
				return {
					teams: entry.teams,
					rawRatio: rawRatio !== null ? roundTo(rawRatio) : null,
					weightedRatio: weightedRatio !== null ? roundTo(weightedRatio) : null
				};
			})
			.filter((entry): entry is { teams: number; rawRatio: number; weightedRatio: number } => {
				return (
					entry.rawRatio !== null &&
					entry.weightedRatio !== null &&
					Number.isFinite(entry.rawRatio) &&
					Number.isFinite(entry.weightedRatio)
				);
			})
	);
	const teamCountRatioSummary = $derived.by(() => {
		if (teamCountRatioData.length === 0) return null;
		const biggestGap = teamCountRatioData.reduce((best, entry) => {
			const gap = Math.abs(entry.weightedRatio - entry.rawRatio);
			const bestGap = Math.abs(best.weightedRatio - best.rawRatio);
			return gap > bestGap ? entry : best;
		});
		const weightedHigher = teamCountRatioData.filter(
			(entry) => entry.weightedRatio > entry.rawRatio
		).length;
		const avgGap =
			teamCountRatioData.reduce(
				(sum, entry) => sum + Math.abs(entry.weightedRatio - entry.rawRatio),
				0
			) / teamCountRatioData.length;
		return { biggestGap, weightedHigher, avgGap, total: teamCountRatioData.length };
	});

	const teamTypeConfig = {
		wins: { label: 'Wins', color: 'var(--chart-4)' },
		losses: { label: 'Losses', color: 'var(--chart-2)' }
	} satisfies Chart.ChartConfig;

	const teamCountConfig = {
		wins: { label: 'Wins', color: 'var(--chart-4)' },
		losses: { label: 'Losses', color: 'var(--chart-2)' }
	} satisfies Chart.ChartConfig;

	const teamCountRatioConfig = {
		rawRatio: { label: 'Raw W/L', color: 'var(--chart-2)' },
		weightedRatio: { label: 'Weighted W/L', color: 'var(--chart-4)' }
	} satisfies Chart.ChartConfig;
</script>

<div class="grid gap-4 lg:grid-cols-2">
	<Card.Root class="group">
		{#snippet teamTypeChart()}
			{#if teamTypeData.length === 0}
				<Empty.Root class="border-muted-foreground/30">
					<h3 class="text-base font-semibold">No team-type data</h3>
					<p class="text-sm text-muted-foreground">Not enough matches in this mode yet.</p>
				</Empty.Root>
			{:else}
				<Chart.Container config={teamTypeConfig} class="min-h-[220px] w-full">
					<BarChart
						data={teamTypeData}
						x="teamType"
						highlight={false}
						bandPadding={0.25}
						seriesLayout="stack"
						padding={chartPadding}
						series={[
							{
								key: 'wins',
								label: teamTypeConfig.wins.label,
								color: teamTypeConfig.wins.color
							},
							{
								key: 'losses',
								label: teamTypeConfig.losses.label,
								color: teamTypeConfig.losses.color
							}
						]}
						props={{
							bars: { stroke: 'none' },
							yAxis: { ...yAxisNoNumbers }
						}}
					>
						{#snippet belowMarks()}
							<Highlight data={activeTeamTypeDatum} area={{ class: 'fill-muted' }} />
						{/snippet}
						{#snippet tooltip()}
							<Chart.Tooltip />
						{/snippet}
					</BarChart>
				</Chart.Container>
			{/if}
		{/snippet}
		{#snippet teamTypeSection({ showHelp }: { showHelp: boolean })}
			<Card.Header class="flex items-start justify-between gap-3">
				<div>
					<Card.Title class="text-base">Win/loss by team type</Card.Title>
					<Card.Description>Results split by team composition.</Card.Description>
				</div>
				{#if showHelp}
					<div
						class="pointer-events-none flex items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
					>
						<GraphHelpSheet
							title="Win/loss by team type"
							preview={teamTypePreview as import('svelte').Snippet<[]>}
							class={iconButtonClass}
						>
							<p class={helpHeadingClass}>How to read</p>
							<p>
								Each bar represents a team composition (duos, trios, “2 teams”, etc.). Dark sections
								are wins, light sections are losses, and the total height is how often that format
								appears.
							</p>
							<p>Use this to see which formats are both common and successful.</p>
							<ul class="list-disc pl-4">
								<li>Darker sections mean more wins.</li>
								<li>Tall bars mean the clan plays that format a lot.</li>
							</ul>
							{#if teamTypeSummary}
								<p class={`${helpHeadingClass} mt-3`}>What this data says</p>
								<p>
									Most played format:
									<button
										type="button"
										class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
										onmouseenter={() => (activeTeamType = teamTypeSummary.mostPlayed.teamType)}
										onmouseleave={() => (activeTeamType = null)}
										onfocus={() => (activeTeamType = teamTypeSummary.mostPlayed.teamType)}
										onblur={() => (activeTeamType = null)}
									>
										{teamTypeSummary.mostPlayed.teamType}
									</button>
									({formatNumber(teamTypeSummary.mostPlayed.total)} matches).
								</p>
								<p>
									Best win rate:
									<button
										type="button"
										class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
										onmouseenter={() => (activeTeamType = teamTypeSummary.bestRate.teamType)}
										onmouseleave={() => (activeTeamType = null)}
										onfocus={() => (activeTeamType = teamTypeSummary.bestRate.teamType)}
										onblur={() => (activeTeamType = null)}
									>
										{teamTypeSummary.bestRate.teamType}
									</button>
									at
									{formatPercent(
										(safeDivide(teamTypeSummary.bestRate.wins, teamTypeSummary.bestRate.total) ??
											0) * 100
									)}.
								</p>
								<p>
									Lowest win rate:
									<button
										type="button"
										class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
										onmouseenter={() => (activeTeamType = teamTypeSummary.worstRate.teamType)}
										onmouseleave={() => (activeTeamType = null)}
										onfocus={() => (activeTeamType = teamTypeSummary.worstRate.teamType)}
										onblur={() => (activeTeamType = null)}
									>
										{teamTypeSummary.worstRate.teamType}
									</button>
									at
									{formatPercent(
										(safeDivide(teamTypeSummary.worstRate.wins, teamTypeSummary.worstRate.total) ??
											0) * 100
									)}.
								</p>
								{#if teamTypeSummary.bestRate.teamType !== teamTypeSummary.mostPlayed.teamType}
									<p>
										This suggests the clan’s best-performing format isn’t the one they play most.
									</p>
								{/if}
							{/if}
						</GraphHelpSheet>
					</div>
				{/if}
			</Card.Header>
			<Card.Content>
				{@render (teamTypeChart as import('svelte').Snippet<[]>)()}
			</Card.Content>
		{/snippet}
		{#snippet teamTypePreview()}
			{@render (teamTypeSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
				showHelp: false
			})}
		{/snippet}
		{@render (teamTypeSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
			showHelp: true
		})}
	</Card.Root>

	<Card.Root class="group">
		{#snippet teamCountChart()}
			{#if teamCountData.length === 0}
				<Empty.Root class="border-muted-foreground/30">
					<h3 class="text-base font-semibold">No team-count data</h3>
					<p class="text-sm text-muted-foreground">Not enough matches with team data.</p>
				</Empty.Root>
			{:else}
				<Chart.Container config={teamCountConfig} class="min-h-[220px] w-full">
					<LineChart
						data={teamCountData}
						x="teams"
						xDomain={teamCountDomain ?? undefined}
						brush={createLineBrush((value) => (teamCountDomain = value))}
						padding={chartPadding}
						series={[
							{
								key: 'wins',
								label: teamCountConfig.wins.label,
								color: teamCountConfig.wins.color
							},
							{
								key: 'losses',
								label: teamCountConfig.losses.label,
								color: teamCountConfig.losses.color
							}
						]}
						props={{
							yAxis: { ...yAxisNoNumbers }
						}}
					>
						{#snippet aboveMarks({ context })}
							{#if activeTeamCount !== null}
								{@const xValue = context.xScale(activeTeamCount)}
								{@const yMin = Math.min(...context.yRange)}
								{@const yMax = Math.max(...context.yRange)}
								{#if Number.isFinite(xValue)}
									<line
										x1={xValue}
										x2={xValue}
										y1={yMin}
										y2={yMax}
										class="stroke-foreground/60"
										stroke-dasharray="4 4"
										stroke-width="1"
										opacity="0.9"
										pointer-events="none"
									/>
								{/if}
							{/if}
						{/snippet}
						{#snippet tooltip()}
							<Chart.Tooltip />
						{/snippet}
					</LineChart>
				</Chart.Container>
			{/if}
		{/snippet}
		{#snippet teamCountSection({ showHelp }: { showHelp: boolean })}
			<Card.Header class="flex items-start justify-between gap-3">
				<div>
					<Card.Title class="text-base">Win/loss by team count</Card.Title>
					<Card.Description>Overall results per number of teams.</Card.Description>
				</div>
				{#if showHelp || teamCountDomain != null}
					<div
						class="pointer-events-none flex items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
					>
						{#if teamCountDomain != null}
							<button
								type="button"
								class={iconButtonClass}
								aria-label="Clear zoom"
								onclick={() => (teamCountDomain = null)}
							>
								<XIcon class="h-4 w-4" />
							</button>
						{/if}
						{#if showHelp}
							<GraphHelpSheet
								title="Win/loss by team count"
								preview={teamCountPreview as import('svelte').Snippet<[]>}
								class={iconButtonClass}
							>
								<p class={helpHeadingClass}>How to read</p>
								<p>
									This line chart shows wins and losses by the number of teams in the match. Peaks
									show where outcomes are concentrated.
								</p>
								<p>Use it to see which team counts are common and which are favorable.</p>
								<ul class="list-disc pl-4">
									<li>Higher peaks mean more wins or losses at that team count.</li>
									<li>Clear spikes highlight comfort zones.</li>
								</ul>
								{#if teamCountSummary}
									<p class={`${helpHeadingClass} mt-3`}>What this data says</p>
									<p>
										Most common team count:
										<button
											type="button"
											class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
											onmouseenter={() => (activeTeamCount = teamCountSummary.mostPlayed.teams)}
											onmouseleave={() => (activeTeamCount = null)}
											onfocus={() => (activeTeamCount = teamCountSummary.mostPlayed.teams)}
											onblur={() => (activeTeamCount = null)}
										>
											{teamCountSummary.mostPlayed.teams}
										</button>
										teams ({formatNumber(teamCountSummary.mostPlayed.total)} matches).
									</p>
									<p>
										Best win rate:
										<button
											type="button"
											class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
											onmouseenter={() => (activeTeamCount = teamCountSummary.bestRate.teams)}
											onmouseleave={() => (activeTeamCount = null)}
											onfocus={() => (activeTeamCount = teamCountSummary.bestRate.teams)}
											onblur={() => (activeTeamCount = null)}
										>
											{teamCountSummary.bestRate.teams}
										</button>
										teams at
										{formatPercent(
											(safeDivide(
												teamCountSummary.bestRate.wins,
												teamCountSummary.bestRate.total
											) ?? 0) * 100
										)}.
									</p>
									<p>
										Lowest win rate:
										<button
											type="button"
											class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
											onmouseenter={() => (activeTeamCount = teamCountSummary.worstRate.teams)}
											onmouseleave={() => (activeTeamCount = null)}
											onfocus={() => (activeTeamCount = teamCountSummary.worstRate.teams)}
											onblur={() => (activeTeamCount = null)}
										>
											{teamCountSummary.worstRate.teams}
										</button>
										teams at
										{formatPercent(
											(safeDivide(
												teamCountSummary.worstRate.wins,
												teamCountSummary.worstRate.total
											) ?? 0) * 100
										)}.
									</p>
								{/if}
							</GraphHelpSheet>
						{/if}
					</div>
				{/if}
			</Card.Header>
			<Card.Content>
				{@render (teamCountChart as import('svelte').Snippet<[]>)()}
			</Card.Content>
		{/snippet}
		{#snippet teamCountPreview()}
			{@render (teamCountSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
				showHelp: false
			})}
		{/snippet}
		{@render (teamCountSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
			showHelp: true
		})}
	</Card.Root>

	<Card.Root class="group lg:col-span-2">
		{#snippet teamCountRatioChart()}
			{#if teamCountRatioData.length === 0}
				<Empty.Root class="border-muted-foreground/30">
					<h3 class="text-base font-semibold">No ratio data</h3>
					<p class="text-sm text-muted-foreground">Not enough matches to compute ratios.</p>
				</Empty.Root>
			{:else}
				<Chart.Container config={teamCountRatioConfig} class="aspect-auto h-[240px] w-full">
					<LineChart
						data={teamCountRatioData}
						x="teams"
						xDomain={teamCountRatioDomain ?? undefined}
						brush={createLineBrush((value) => (teamCountRatioDomain = value))}
						padding={chartPadding}
						series={[
							{
								key: 'rawRatio',
								label: teamCountRatioConfig.rawRatio.label,
								color: teamCountRatioConfig.rawRatio.color
							},
							{
								key: 'weightedRatio',
								label: teamCountRatioConfig.weightedRatio.label,
								color: teamCountRatioConfig.weightedRatio.color
							}
						]}
						props={{
							yAxis: { ...yAxisNoNumbers }
						}}
					>
						{#snippet aboveMarks({ context })}
							{#if activeTeamCountRatio !== null}
								{@const xValue = context.xScale(activeTeamCountRatio)}
								{@const yMin = Math.min(...context.yRange)}
								{@const yMax = Math.max(...context.yRange)}
								{#if Number.isFinite(xValue)}
									<line
										x1={xValue}
										x2={xValue}
										y1={yMin}
										y2={yMax}
										class="stroke-foreground/60"
										stroke-dasharray="4 4"
										stroke-width="1"
										opacity="0.9"
										pointer-events="none"
									/>
								{/if}
							{/if}
						{/snippet}
						{#snippet tooltip()}
							<Chart.Tooltip />
						{/snippet}
					</LineChart>
				</Chart.Container>
			{/if}
		{/snippet}
		{#snippet teamCountRatioSection({ showHelp }: { showHelp: boolean })}
			<Card.Header class="flex items-start justify-between gap-3">
				<div>
					<Card.Title class="text-base">Weighted vs raw W/L ratio</Card.Title>
					<Card.Description>Compare raw and weighted ratios by team count.</Card.Description>
				</div>
				{#if showHelp || teamCountRatioDomain != null}
					<div
						class="pointer-events-none flex items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
					>
						{#if teamCountRatioDomain != null}
							<button
								type="button"
								class={iconButtonClass}
								aria-label="Clear zoom"
								onclick={() => (teamCountRatioDomain = null)}
							>
								<XIcon class="h-4 w-4" />
							</button>
						{/if}
						{#if showHelp}
							<GraphHelpSheet
								title="Weighted vs raw W/L ratio"
								preview={teamCountRatioPreview as import('svelte').Snippet<[]>}
								class={iconButtonClass}
							>
								<p class={helpHeadingClass}>How to read</p>
								<p>
									Two lines show the raw win/loss ratio and the weighted version. Weighted ratios
									give extra credit for tougher wins.
								</p>
								<p>Use this to see where strength-adjusted results tell a different story.</p>
								<ul class="list-disc pl-4">
									<li>If the weighted line is higher, wins were tougher.</li>
									<li>Large gaps mean the weighting changes the story.</li>
								</ul>
								{#if teamCountRatioSummary}
									<p class={`${helpHeadingClass} mt-3`}>What this data says</p>
									<p>
										Biggest gap at
										<button
											type="button"
											class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
											onmouseenter={() =>
												(activeTeamCountRatio = teamCountRatioSummary.biggestGap.teams)}
											onmouseleave={() => (activeTeamCountRatio = null)}
											onfocus={() =>
												(activeTeamCountRatio = teamCountRatioSummary.biggestGap.teams)}
											onblur={() => (activeTeamCountRatio = null)}
										>
											{teamCountRatioSummary.biggestGap.teams}
										</button>
										teams: weighted {formatRatio(teamCountRatioSummary.biggestGap.weightedRatio)} vs raw
										{formatRatio(teamCountRatioSummary.biggestGap.rawRatio)}.
									</p>
									<p>
										Weighted ratio is higher in
										{formatNumber(teamCountRatioSummary.weightedHigher)} of
										{formatNumber(teamCountRatioSummary.total)} team counts, with an average gap of
										{formatRatio(teamCountRatioSummary.avgGap)}.
									</p>
								{/if}
							</GraphHelpSheet>
						{/if}
					</div>
				{/if}
			</Card.Header>
			<Card.Content>
				{@render (teamCountRatioChart as import('svelte').Snippet<[]>)()}
			</Card.Content>
		{/snippet}
		{#snippet teamCountRatioPreview()}
			{@render (teamCountRatioSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
				showHelp: false
			})}
		{/snippet}
		{@render (teamCountRatioSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
			showHelp: true
		})}
	</Card.Root>
</div>
