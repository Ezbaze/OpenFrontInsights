<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Chart from '$lib/components/ui/chart';
	import * as Empty from '$lib/components/ui/empty';
	import { BarChart, Highlight } from 'layerchart';
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

	const topCount = 10;

	let activeWeightedWinsTag = $state<string | null>(null);
	let activeWeightedWinsTags = $state<string[] | null>(null);
	let activeWeightedWinsValues = $state<number[] | null>(null);
	let activeWinsLossesTag = $state<string | null>(null);
	let activeGamesTag = $state<string | null>(null);
	let activeGamesValues = $state<number[] | null>(null);

	const topEntries = $derived.by<ClanLeaderboardEntry[]>(() =>
		(entries as ClanLeaderboardEntry[]).slice(0, topCount)
	);
	const weightedWinsSummary = $derived.by(() => {
		if (topEntries.length === 0) return null;
		const sorted = [...topEntries].sort((a, b) => b.weightedWins - a.weightedWins);
		const total = sorted.reduce((sum, entry) => sum + entry.weightedWins, 0);
		const leader = sorted[0];
		const runner = sorted[1] ?? null;
		const lead = runner ? leader.weightedWins - runner.weightedWins : null;
		const top3Total = sorted.slice(0, 3).reduce((sum, entry) => sum + entry.weightedWins, 0);
		const top3Share = total > 0 ? (top3Total / total) * 100 : null;
		return {
			leader,
			runner,
			lead,
			top3Share,
			total,
			top3Tags: sorted.slice(0, 3).map((entry) => entry.clanTag)
		};
	});
	const mostGamesEntry = $derived.by(() => {
		if (topEntries.length === 0) return null;
		return topEntries.reduce((best, entry) => (entry.games > best.games ? entry : best));
	});
	const gamesSummary = $derived.by(() => {
		if (topEntries.length === 0) return null;
		const games = topEntries.map((entry) => entry.games).sort((a, b) => a - b);
		const min = games[0];
		const max = games[games.length - 1];
		const mid = Math.floor(games.length / 2);
		const median = games.length % 2 === 0 ? (games[mid - 1] + games[mid]) / 2 : games[mid];
		return { min, max, median };
	});
	const bestWinRateEntry = $derived.by(() => {
		if (topEntries.length === 0) return null;
		return topEntries.reduce((best, entry) => {
			const entryRate = safeDivide(entry.wins, entry.wins + entry.losses) ?? -1;
			const bestRate = safeDivide(best.wins, best.wins + best.losses) ?? -1;
			return entryRate > bestRate ? entry : best;
		});
	});
	const winsLossesSummary = $derived.by(() => {
		if (topEntries.length === 0) return null;
		const totalWins = topEntries.reduce((sum, entry) => sum + entry.wins, 0);
		const totalLosses = topEntries.reduce((sum, entry) => sum + entry.losses, 0);
		const overallRate = safeDivide(totalWins, totalWins + totalLosses);
		return { totalWins, totalLosses, overallRate };
	});

	const weightedWinsData = $derived.by(() =>
		topEntries.map((entry) => ({
			clanTag: entry.clanTag,
			weightedWins: entry.weightedWins
		}))
	);

	const winsLossesData = $derived.by(() =>
		topEntries.map((entry) => ({
			clanTag: entry.clanTag,
			wins: entry.wins,
			losses: entry.losses
		}))
	);
	const gamesData = $derived.by(() =>
		topEntries.map((entry) => ({
			clanTag: entry.clanTag,
			games: entry.games
		}))
	);
	const activeWeightedWinsData = $derived.by(() => {
		const hoverTags = activeWeightedWinsTags ?? [];
		if (hoverTags.length > 0) {
			return weightedWinsData.filter((entry) => hoverTags.includes(entry.clanTag));
		}
		if (activeWeightedWinsTag === null) return [];
		const activeDatum = weightedWinsData.find((entry) => entry.clanTag === activeWeightedWinsTag);
		return activeDatum ? [activeDatum] : [];
	});
	const activeWinsLossesDatum = $derived.by(() =>
		activeWinsLossesTag === null
			? undefined
			: winsLossesData.find((entry) => entry.clanTag === activeWinsLossesTag)
	);
	const activeGamesDatum = $derived.by(() =>
		activeGamesTag === null ? undefined : gamesData.find((entry) => entry.clanTag === activeGamesTag)
	);

	const weightedWinsConfig = {
		weightedWins: {
			label: 'Weighted Wins',
			color: 'var(--chart-4)'
		}
	} satisfies Chart.ChartConfig;

	const winsLossesConfig = {
		wins: {
			label: 'Wins',
			color: 'var(--chart-4)'
		},
		losses: {
			label: 'Losses',
			color: 'var(--chart-2)'
		}
	} satisfies Chart.ChartConfig;

	const gamesConfig = {
		games: {
			label: 'Games',
			color: 'var(--chart-3)'
		}
	} satisfies Chart.ChartConfig;
</script>

<Card.Root class="group">
	{#snippet weightedWinsChart()}
		{#if weightedWinsData.length === 0}
			<Empty.Root class="border-muted-foreground/30">
				<h3 class="text-base font-semibold">No data yet</h3>
				<p class="text-sm text-muted-foreground">Refresh the leaderboard to load clan stats.</p>
			</Empty.Root>
		{:else}
			<Chart.Container config={weightedWinsConfig} class="min-h-[220px] w-full">
				<BarChart
					data={weightedWinsData}
					x="clanTag"
					highlight={false}
					bandPadding={0.3}
					padding={chartPadding}
					series={[
						{
							key: 'weightedWins',
							label: weightedWinsConfig.weightedWins.label,
							color: weightedWinsConfig.weightedWins.color
						}
					]}
					props={{
						bars: { stroke: 'none' },
						yAxis: { ...yAxisNoNumbers }
					}}
				>
					{#snippet belowMarks()}
						{#each activeWeightedWinsData as activeDatum (activeDatum.clanTag)}
							<Highlight data={activeDatum} area={{ class: 'fill-muted' }} />
						{/each}
					{/snippet}
					{#snippet aboveMarks({ context })}
						{#if activeWeightedWinsValues && Array.isArray(context.xRange)}
							{#each activeWeightedWinsValues as value (value)}
								{@const yValue = context.yScale(value)}
								{#if Number.isFinite(yValue)}
									<line
										x1={context.xRange[0]}
										x2={context.xRange[1]}
										y1={yValue}
										y2={yValue}
										class="stroke-foreground/60"
										stroke-dasharray="4 4"
										stroke-width="1"
										opacity="0.9"
										pointer-events="none"
									/>
								{/if}
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
	{#snippet weightedWinsSection({ showHelp }: { showHelp: boolean })}
		<Card.Header class="flex items-start justify-between gap-3">
			<div>
				<Card.Title class="text-lg">Weighted wins (top clans)</Card.Title>
				<Card.Description>Highest weighted wins across the current leaderboard.</Card.Description>
			</div>
			{#if showHelp}
				<div
					class="pointer-events-none flex items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
				>
					<GraphHelpSheet
						title="Weighted wins (top clans)"
						preview={weightedWinsPreview as import('svelte').Snippet<[]>}
						class={iconButtonClass}
					>
						<p class={helpHeadingClass}>How to read</p>
						<p>
							Each bar shows how many weighted wins a clan has. Weighted wins give extra credit for
							beating stronger opponents, so they reward quality over volume.
						</p>
						<p>
							Use this to spot who is truly outperforming the field, even if they play less often.
						</p>
						<ul class="list-disc pl-4">
							<li>Taller bars mean stronger overall results after difficulty is considered.</li>
							<li>Big gaps usually indicate a clear leader.</li>
						</ul>
						{#if weightedWinsSummary}
							<p class={`${helpHeadingClass} mt-3`}>What this data says</p>
							<p>
								Right now,
								<button
									type="button"
									class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
									onmouseenter={() => {
										activeWeightedWinsValues = null;
										activeWeightedWinsTags = null;
										activeWeightedWinsTag = weightedWinsSummary.leader.clanTag;
									}}
									onmouseleave={() => (activeWeightedWinsTag = null)}
									onfocus={() => {
										activeWeightedWinsValues = null;
										activeWeightedWinsTags = null;
										activeWeightedWinsTag = weightedWinsSummary.leader.clanTag;
									}}
									onblur={() => (activeWeightedWinsTag = null)}
								>
									{weightedWinsSummary.leader.clanTag}
								</button>
								leads with
								<button
									type="button"
									class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
									onmouseenter={() => {
										activeWeightedWinsTag = null;
										activeWeightedWinsTags = null;
										activeWeightedWinsValues = [weightedWinsSummary.leader.weightedWins];
									}}
									onmouseleave={() => {
										activeWeightedWinsValues = null;
										activeWeightedWinsTags = null;
										activeWeightedWinsTag = null;
									}}
									onfocus={() => {
										activeWeightedWinsTag = null;
										activeWeightedWinsTags = null;
										activeWeightedWinsValues = [weightedWinsSummary.leader.weightedWins];
									}}
									onblur={() => {
										activeWeightedWinsValues = null;
										activeWeightedWinsTags = null;
										activeWeightedWinsTag = null;
									}}
								>
									{formatNumber(weightedWinsSummary.leader.weightedWins)}
								</button>
								weighted wins.
							</p>
							{#if weightedWinsSummary.lead !== null && weightedWinsSummary.runner}
								<p>
									They are ahead of
									<button
										type="button"
										class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
										onmouseenter={() => {
											activeWeightedWinsValues = null;
											activeWeightedWinsTags = null;
											activeWeightedWinsTag = weightedWinsSummary.runner?.clanTag ?? null;
										}}
										onmouseleave={() => (activeWeightedWinsTag = null)}
										onfocus={() => {
											activeWeightedWinsValues = null;
											activeWeightedWinsTags = null;
											activeWeightedWinsTag = weightedWinsSummary.runner?.clanTag ?? null;
										}}
										onblur={() => (activeWeightedWinsTag = null)}
									>
										{weightedWinsSummary.runner.clanTag}
									</button>
									by
									<button
										type="button"
										class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
									onmouseenter={() => {
										activeWeightedWinsTag = null;
										activeWeightedWinsTags = null;
										activeWeightedWinsValues = weightedWinsSummary.runner
											? [
													weightedWinsSummary.leader.weightedWins,
														weightedWinsSummary.runner.weightedWins
													]
												: [weightedWinsSummary.leader.weightedWins];
										}}
										onmouseleave={() => {
											activeWeightedWinsValues = null;
											activeWeightedWinsTags = null;
											activeWeightedWinsTag = null;
										}}
									onfocus={() => {
										activeWeightedWinsTag = null;
										activeWeightedWinsTags = null;
										activeWeightedWinsValues = weightedWinsSummary.runner
											? [
													weightedWinsSummary.leader.weightedWins,
														weightedWinsSummary.runner.weightedWins
													]
												: [weightedWinsSummary.leader.weightedWins];
										}}
										onblur={() => {
											activeWeightedWinsValues = null;
											activeWeightedWinsTags = null;
											activeWeightedWinsTag = null;
										}}
									>
										{formatNumber(weightedWinsSummary.lead)}
									</button>
									.
								</p>
							{/if}
							{#if weightedWinsSummary.top3Share !== null}
								<p>
									The
									<button
										type="button"
										class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
										onmouseenter={() => {
											activeWeightedWinsValues = null;
											activeWeightedWinsTag = null;
											activeWeightedWinsTags = weightedWinsSummary.top3Tags;
										}}
										onmouseleave={() => (activeWeightedWinsTags = null)}
										onfocus={() => {
											activeWeightedWinsValues = null;
											activeWeightedWinsTag = null;
											activeWeightedWinsTags = weightedWinsSummary.top3Tags;
										}}
										onblur={() => (activeWeightedWinsTags = null)}
									>
										top 3
									</button>
									account for about {formatPercent(weightedWinsSummary.top3Share)} of weighted wins in
									this view.
								</p>
							{/if}
						{/if}
					</GraphHelpSheet>
				</div>
			{/if}
		</Card.Header>
		<Card.Content>
			{@render (weightedWinsChart as import('svelte').Snippet<[]>)()}
		</Card.Content>
	{/snippet}
	{#snippet weightedWinsPreview()}
		{@render (weightedWinsSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
			showHelp: false
		})}
	{/snippet}
	{@render (weightedWinsSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
		showHelp: true
	})}
</Card.Root>

<Card.Root class="group">
	{#snippet winsLossesChart()}
		{#if winsLossesData.length === 0}
			<Empty.Root class="border-muted-foreground/30">
				<h3 class="text-base font-semibold">No data yet</h3>
				<p class="text-sm text-muted-foreground">Refresh the leaderboard to load clan stats.</p>
			</Empty.Root>
		{:else}
			<Chart.Container config={winsLossesConfig} class="min-h-[220px] w-full">
				<BarChart
					data={winsLossesData}
					x="clanTag"
					highlight={false}
					bandPadding={0.3}
					seriesLayout="stack"
					padding={chartPadding}
					series={[
						{
							key: 'wins',
							label: winsLossesConfig.wins.label,
							color: winsLossesConfig.wins.color
						},
						{
							key: 'losses',
							label: winsLossesConfig.losses.label,
							color: winsLossesConfig.losses.color
						}
					]}
					props={{
						bars: { stroke: 'none' },
						yAxis: { ...yAxisNoNumbers }
					}}
				>
					{#snippet belowMarks()}
						<Highlight data={activeWinsLossesDatum} area={{ class: 'fill-muted' }} />
					{/snippet}
					{#snippet tooltip()}
						<Chart.Tooltip />
					{/snippet}
				</BarChart>
			</Chart.Container>
		{/if}
	{/snippet}
	{#snippet winsLossesSection({ showHelp }: { showHelp: boolean })}
		<Card.Header class="flex items-start justify-between gap-3">
			<div>
				<Card.Title class="text-lg">Wins vs losses (top clans)</Card.Title>
				<Card.Description>Stacked match results for the top {topCount} clans.</Card.Description>
			</div>
			{#if showHelp}
				<div
					class="pointer-events-none flex items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
				>
					<GraphHelpSheet
						title="Wins vs losses (top clans)"
						preview={winsLossesPreview as import('svelte').Snippet<[]>}
						class={iconButtonClass}
					>
						<p class={helpHeadingClass}>How to read</p>
						<p>
							Each bar stacks wins (dark) on top of losses (light), so total height equals total
							games played. It’s an easy way to compare both volume and success at once.
						</p>
						<p>Use this to see who is winning more than they lose, and who is just active.</p>
						<ul class="list-disc pl-4">
							<li>More dark blue than light means a positive record.</li>
							<li>Very tall bars mean lots of matches, regardless of outcome.</li>
						</ul>
						{#if bestWinRateEntry || winsLossesSummary}
							<p class={`${helpHeadingClass} mt-3`}>What this data says</p>
							{#if bestWinRateEntry}
								<p>
									Best win rate in this group:
									<button
										type="button"
										class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
										onmouseenter={() => (activeWinsLossesTag = bestWinRateEntry.clanTag)}
										onmouseleave={() => (activeWinsLossesTag = null)}
										onfocus={() => (activeWinsLossesTag = bestWinRateEntry.clanTag)}
										onblur={() => (activeWinsLossesTag = null)}
									>
										{bestWinRateEntry.clanTag}
									</button>
									at
									{formatPercent(
										(safeDivide(
											bestWinRateEntry.wins,
											bestWinRateEntry.wins + bestWinRateEntry.losses
										) ?? 0) * 100
									)}.
								</p>
							{/if}
							{#if winsLossesSummary}
								<p>
									Across the top {topCount}, the combined record is
									{formatNumber(winsLossesSummary.totalWins)}-{formatNumber(
										winsLossesSummary.totalLosses
									)}
									({formatPercent((winsLossesSummary.overallRate ?? 0) * 100)} win rate).
								</p>
							{/if}
						{/if}
					</GraphHelpSheet>
				</div>
			{/if}
		</Card.Header>
		<Card.Content>
			{@render (winsLossesChart as import('svelte').Snippet<[]>)()}
		</Card.Content>
	{/snippet}
	{#snippet winsLossesPreview()}
		{@render (winsLossesSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
			showHelp: false
		})}
	{/snippet}
	{@render (winsLossesSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
		showHelp: true
	})}
</Card.Root>

<Card.Root class="group">
	{#snippet gamesChart()}
		{#if gamesData.length === 0}
			<Empty.Root class="border-muted-foreground/30">
				<h3 class="text-base font-semibold">No data yet</h3>
				<p class="text-sm text-muted-foreground">Refresh the leaderboard to load clan stats.</p>
			</Empty.Root>
		{:else}
			<Chart.Container config={gamesConfig} class="min-h-[220px] w-full">
				<BarChart
					data={gamesData}
					x="clanTag"
					highlight={false}
					bandPadding={0.3}
					padding={chartPadding}
					series={[
						{
							key: 'games',
							label: gamesConfig.games.label,
							color: gamesConfig.games.color
						}
					]}
					props={{
						bars: { stroke: 'none' },
						yAxis: { ...yAxisNoNumbers }
					}}
				>
					{#snippet belowMarks()}
						<Highlight data={activeGamesDatum} area={{ class: 'fill-muted' }} />
					{/snippet}
					{#snippet aboveMarks({ context })}
						{#if activeGamesValues && Array.isArray(context.xRange)}
							{@const xStart = context.xRange[0]}
							{@const xEnd = context.xRange[1]}
							{#each activeGamesValues as value (value)}
								{@const yValue = context.yScale(value)}
								{#if Number.isFinite(yValue)}
									<line
										x1={xStart}
										x2={xEnd}
										y1={yValue}
										y2={yValue}
										class="stroke-foreground/60"
										stroke-dasharray="4 4"
										stroke-width="1"
										opacity="0.9"
										pointer-events="none"
									/>
								{/if}
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
	{#snippet gamesSection({ showHelp }: { showHelp: boolean })}
		<Card.Header class="flex items-start justify-between gap-3">
			<div>
				<Card.Title class="text-lg">Games played (top clans)</Card.Title>
				<Card.Description>Total matches across the top {topCount} clans.</Card.Description>
			</div>
			{#if showHelp}
				<div
					class="pointer-events-none flex items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
				>
					<GraphHelpSheet
						title="Games played (top clans)"
						preview={gamesPreview as import('svelte').Snippet<[]>}
						class={iconButtonClass}
					>
						<p class={helpHeadingClass}>How to read</p>
						<p>
							This chart is pure activity: each bar is the number of games a clan has played. No
							wins or losses here—just volume.
						</p>
						<p>Use it to spot the most active clans and the ones with smaller sample sizes.</p>
						<ul class="list-disc pl-4">
							<li>Taller bars mean more matches played.</li>
							<li>High games with low wins suggests volume over results.</li>
						</ul>
						{#if mostGamesEntry || gamesSummary}
							<p class={`${helpHeadingClass} mt-3`}>What this data says</p>
							{#if mostGamesEntry}
								<p>
									Most active clan:
									<button
										type="button"
										class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
										onmouseenter={() => {
											activeGamesValues = null;
											activeGamesTag = mostGamesEntry.clanTag;
										}}
										onmouseleave={() => (activeGamesTag = null)}
										onfocus={() => {
											activeGamesValues = null;
											activeGamesTag = mostGamesEntry.clanTag;
										}}
										onblur={() => (activeGamesTag = null)}
									>
										{mostGamesEntry.clanTag}
									</button>
									with {formatNumber(mostGamesEntry.games)} games.
								</p>
							{/if}
							{#if gamesSummary}
								<p>
									<button
										type="button"
										class="cursor-pointer"
										onmouseenter={() => {
											activeGamesTag = null;
											activeGamesValues = [gamesSummary.min, gamesSummary.max];
										}}
										onmouseleave={() => (activeGamesValues = null)}
										onfocus={() => {
											activeGamesTag = null;
											activeGamesValues = [gamesSummary.min, gamesSummary.max];
										}}
										onblur={() => (activeGamesValues = null)}
									>
										Games range from
										<span
											class="font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
										>
											{formatNumber(gamesSummary.min)}
										</span>
										to
										<span
											class="font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
										>
											{formatNumber(gamesSummary.max)}
										</span>
									</button>
									, with a median around
									<button
										type="button"
										class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
										onmouseenter={() => {
											activeGamesTag = null;
											activeGamesValues = [gamesSummary.median];
										}}
										onmouseleave={() => (activeGamesValues = null)}
										onfocus={() => {
											activeGamesTag = null;
											activeGamesValues = [gamesSummary.median];
										}}
										onblur={() => (activeGamesValues = null)}
									>
										{formatNumber(gamesSummary.median)}
									</button>
									.
								</p>
							{/if}
						{/if}
					</GraphHelpSheet>
				</div>
			{/if}
		</Card.Header>
		<Card.Content>
			{@render (gamesChart as import('svelte').Snippet<[]>)()}
		</Card.Content>
	{/snippet}
	{#snippet gamesPreview()}
		{@render (gamesSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
			showHelp: false
		})}
	{/snippet}
	{@render (gamesSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({ showHelp: true })}
</Card.Root>
