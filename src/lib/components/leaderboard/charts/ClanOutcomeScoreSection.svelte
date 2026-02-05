<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Chart from '$lib/components/ui/chart';
	import * as Empty from '$lib/components/ui/empty';
	import { Bar, BarChart, ScatterChart } from 'layerchart';
	import type { ClanSession } from '$lib/types/openfront';
	import { SvelteMap } from 'svelte/reactivity';
	import XIcon from '@lucide/svelte/icons/x';
	import GraphHelpSheet from '../GraphHelpSheet.svelte';
	import ScatterTooltip from '../ScatterTooltip.svelte';
	import {
		chartPadding,
		createScatterBrush,
		formatNumber,
		formatPercent,
		formatRatio,
		getDomain,
		helpHeadingClass,
		iconButtonClass,
		safeDivide,
		yAxisNoNumbers
	} from './chart-utils';
	import {
		getSessionClanPlayers,
		getSessionGameCode,
		getSessionHasWon,
		getSessionKey,
		getSessionNumTeams,
		getSessionScore,
		getSessionTotalPlayers
	} from './clan-session-utils';

	let { clanSessions = [], onSessionFocus } = $props<{
		clanSessions?: ClanSession[];
		onSessionFocus?: (sessionKey: string) => void;
	}>();

	let activeOutcomeTeams = $state<number | null>(null);
	let activeScoreMode = $state<'avg' | 'delta' | null>(null);
	let scoreZoomX = $state<import('./chart-utils').ChartDomain | null>(null);
	let scoreZoomY = $state<import('./chart-utils').ChartDomain | null>(null);

	const outcomesByTeamCount = $derived.by(() => {
		const map = new SvelteMap<number, { teams: number; wins: number; losses: number }>();
		for (const session of clanSessions) {
			const teams = Number(getSessionNumTeams(session));
			const hasWon = getSessionHasWon(session);
			if (!Number.isFinite(teams) || teams <= 0 || hasWon === null) continue;
			const current = map.get(teams) ?? { teams, wins: 0, losses: 0 };
			if (hasWon) {
				current.wins += 1;
			} else {
				current.losses += 1;
			}
			map.set(teams, current);
		}
		return Array.from(map.values()).sort((a, b) => a.teams - b.teams);
	});
	const outcomesSummary = $derived.by(() => {
		if (outcomesByTeamCount.length === 0) return null;
		const totals = outcomesByTeamCount
			.map((entry) => ({
				...entry,
				total: entry.wins + entry.losses
			}))
			.filter((entry) => entry.total > 0);
		if (totals.length === 0) return null;
		const mostCommon = totals.reduce((best, entry) => (entry.total > best.total ? entry : best));
		const bestRate = totals.reduce((best, entry) => {
			const entryRate = safeDivide(entry.wins, entry.total) ?? -1;
			const bestRateValue = safeDivide(best.wins, best.total) ?? -1;
			return entryRate > bestRateValue ? entry : best;
		});
		const overallWins = totals.reduce((sum, entry) => sum + entry.wins, 0);
		const overallLosses = totals.reduce((sum, entry) => sum + entry.losses, 0);
		const overallRate = safeDivide(overallWins, overallWins + overallLosses);
		return { mostCommon, bestRate, overallRate };
	});

	const scoreParticipation = $derived.by(() => {
		const data: {
			participation: number;
			score: number;
			totalPlayers: number;
			gameCode?: string | number;
			sessionKey: string;
		}[] = [];
		for (const session of clanSessions) {
			const clanPlayers = Number(getSessionClanPlayers(session));
			const totalPlayers = Number(getSessionTotalPlayers(session));
			const score = Number(getSessionScore(session));
			if (!Number.isFinite(clanPlayers) || !Number.isFinite(totalPlayers) || totalPlayers <= 0) {
				continue;
			}
			if (!Number.isFinite(score)) continue;
			const participation = clanPlayers / totalPlayers;
			data.push({
				participation,
				score,
				totalPlayers,
				gameCode: (() => {
					const code = getSessionGameCode(session);
					return typeof code === 'string' || typeof code === 'number' ? code : undefined;
				})(),
				sessionKey: getSessionKey(session)
			});
		}
		return data;
	});
	const scoreSummary = $derived.by(() => {
		if (scoreParticipation.length === 0) return null;
		const sorted = [...scoreParticipation].sort((a, b) => a.participation - b.participation);
		const midpoint = Math.floor(sorted.length / 2);
		const lower = sorted.slice(0, midpoint);
		const upper = sorted.slice(midpoint);
		const avg = (items: typeof scoreParticipation) =>
			items.reduce((sum, entry) => sum + entry.score, 0) / (items.length || 1);
		const lowAvg = avg(lower);
		const highAvg = avg(upper);
		const avgParticipation =
			scoreParticipation.reduce((sum, entry) => sum + entry.participation, 0) /
			scoreParticipation.length;
		const delta = highAvg - lowAvg;
		return { lowAvg, highAvg, avgParticipation, delta };
	});
	const participationDomain = $derived.by(() =>
		getDomain(
			scoreParticipation.map((entry) => entry.participation),
			0.08,
			{ min: 0, max: 1 }
		)
	);
	const scoreDomain = $derived.by(() => getDomain(scoreParticipation.map((entry) => entry.score)));

	const outcomesConfig = {
		wins: { label: 'Wins', color: 'var(--chart-4)' },
		losses: { label: 'Losses', color: 'var(--chart-2)' }
	} satisfies Chart.ChartConfig;

	const scoreConfig = {
		sessions: { label: 'Sessions', color: 'var(--chart-5)' }
	} satisfies Chart.ChartConfig;
</script>

<Card.Root class="group lg:col-span-2">
	{#snippet outcomesChart()}
		<Chart.Container config={outcomesConfig} class="aspect-auto h-[240px] w-full">
			<BarChart
				data={outcomesByTeamCount}
				x="teams"
				bandPadding={0.3}
				seriesLayout="stack"
				padding={chartPadding}
				series={[
					{
						key: 'wins',
						label: outcomesConfig.wins.label,
						color: outcomesConfig.wins.color
					},
					{
						key: 'losses',
						label: outcomesConfig.losses.label,
						color: outcomesConfig.losses.color
					}
				]}
				props={{
					bars: { stroke: 'none' },
					yAxis: { ...yAxisNoNumbers }
				}}
			>
				{#snippet marks({ context, visibleSeries, getBarsProps })}
					{#if visibleSeries.length}
						{#each visibleSeries as series, seriesIndex (series.key)}
							{@const barProps = getBarsProps(series, seriesIndex)}
							{#each context.flatData as rawPoint, i ((rawPoint as { teams?: number }).teams ?? i)}
								{@const d = rawPoint as { teams?: number }}
								{@const isActive = activeOutcomeTeams !== null && d.teams === activeOutcomeTeams}
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
						{/each}
					{/if}
				{/snippet}
				{#snippet tooltip()}
					<Chart.Tooltip />
				{/snippet}
			</BarChart>
		</Chart.Container>
	{/snippet}
	{#snippet outcomesSection({ showHelp }: { showHelp: boolean })}
		<Card.Header class="flex items-start justify-between gap-3">
			<div>
				<Card.Title class="text-base">Outcome by team count</Card.Title>
				<Card.Description>Win/loss totals by number of teams.</Card.Description>
			</div>
			{#if showHelp}
				<div
					class="pointer-events-none flex items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
				>
					<GraphHelpSheet
						title="Outcome by team count"
						preview={outcomesPreview as import('svelte').Snippet<[]>}
						class={iconButtonClass}
					>
						<p class={helpHeadingClass}>How to read</p>
						<p>
							Stacked bars show wins and losses for each team count. This highlights how often the
							clan wins at different match sizes.
						</p>
						<p>Use this to spot where the clan performs best.</p>
						<ul class="list-disc pl-4">
							<li>Higher bars mean more matches at that team count.</li>
							<li>More dark means more wins.</li>
						</ul>
						{#if outcomesSummary}
							<p class={`${helpHeadingClass} mt-3`}>What this data says</p>
							<p>
								Most common team count:
								<button
									type="button"
									class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
									onmouseenter={() => (activeOutcomeTeams = outcomesSummary.mostCommon.teams)}
									onmouseleave={() => (activeOutcomeTeams = null)}
									onfocus={() => (activeOutcomeTeams = outcomesSummary.mostCommon.teams)}
									onblur={() => (activeOutcomeTeams = null)}
								>
									{outcomesSummary.mostCommon.teams}
								</button>
								teams ({formatNumber(outcomesSummary.mostCommon.total)} matches).
							</p>
							<p>
								Best win rate:
								<button
									type="button"
									class="cursor-pointer font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
									onmouseenter={() => (activeOutcomeTeams = outcomesSummary.bestRate.teams)}
									onmouseleave={() => (activeOutcomeTeams = null)}
									onfocus={() => (activeOutcomeTeams = outcomesSummary.bestRate.teams)}
									onblur={() => (activeOutcomeTeams = null)}
								>
									{outcomesSummary.bestRate.teams}
								</button>
								teams at
								{formatPercent(
									(safeDivide(outcomesSummary.bestRate.wins, outcomesSummary.bestRate.total) ?? 0) *
										100
								)}.
							</p>
							<p>
								Overall win rate across all team counts:
								{formatPercent((outcomesSummary.overallRate ?? 0) * 100)}.
							</p>
						{/if}
					</GraphHelpSheet>
				</div>
			{/if}
		</Card.Header>
		<Card.Content>
			{@render (outcomesChart as import('svelte').Snippet<[]>)()}
		</Card.Content>
	{/snippet}
	{#snippet outcomesPreview()}
		{@render (outcomesSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
			showHelp: false
		})}
	{/snippet}
	{@render (outcomesSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
		showHelp: true
	})}
</Card.Root>

<Card.Root class="group lg:col-span-2">
	{#snippet scoreChart()}
		{#if scoreParticipation.length === 0}
			<Empty.Root class="border-muted-foreground/30">
				<h3 class="text-base font-semibold">No score data</h3>
				<p class="text-sm text-muted-foreground">Scores are missing for recent sessions.</p>
			</Empty.Root>
		{:else}
			<Chart.Container config={scoreConfig} class="min-h-[240px] w-full">
				<ScatterChart
					x="participation"
					y="score"
					xDomain={scoreZoomX ?? participationDomain}
					yDomain={scoreZoomY ?? scoreDomain}
					brush={createScatterBrush(({ xDomain, yDomain }) => {
						scoreZoomX = xDomain;
						scoreZoomY = yDomain;
					})}
					r="totalPlayers"
					rRange={[3, 10]}
					padding={chartPadding}
					highlight={false}
					onTooltipClick={(_, detail) => {
						const key = (detail?.data as { sessionKey?: string })?.sessionKey;
						if (key) onSessionFocus?.(String(key));
					}}
					series={[
						{
							key: 'sessions',
							label: scoreConfig.sessions.label,
							color: scoreConfig.sessions.color,
							data: scoreParticipation
						}
					]}
					props={{
						xAxis: {
							format: (value) => `${Math.round(Number(value) * 100)}%`
						},
						yAxis: { ...yAxisNoNumbers },
						points: { class: 'cursor-pointer' }
					}}
				>
					{#snippet aboveMarks({ context })}
						{#if scoreSummary && activeScoreMode}
							{@const xMin = Math.min(...context.xRange)}
							{@const xMax = Math.max(...context.xRange)}
							{@const yMin = Math.min(...context.yRange)}
							{@const yMax = Math.max(...context.yRange)}
							{@const xAvg = context.xScale(scoreSummary.avgParticipation)}
							{#if activeScoreMode === 'avg' && Number.isFinite(xAvg)}
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
							{:else if activeScoreMode === 'delta'}
								{@const yHigh = context.yScale(scoreSummary.highAvg)}
								{@const yLow = context.yScale(scoreSummary.lowAvg)}
								{#if Number.isFinite(yHigh)}
									<line
										x1={xMin}
										x2={xMax}
										y1={yHigh}
										y2={yHigh}
										class="stroke-foreground/60"
										stroke-dasharray="4 4"
										stroke-width="1"
										opacity="0.9"
										pointer-events="none"
									/>
								{/if}
								{#if Number.isFinite(yLow)}
									<line
										x1={xMin}
										x2={xMax}
										y1={yLow}
										y2={yLow}
										class="stroke-foreground/60"
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
							title={() => 'Session'}
							meta={(data) => (data as { gameCode?: string | number }).gameCode ?? null}
							metaLabelText=""
							rows={[
								{
									label: 'Participation',
									value: (data) => {
										const value = (data as { participation?: number }).participation;
										if (value === undefined || !Number.isFinite(value)) return null;
										return `${Math.round(value * 100)}%`;
									}
								},
								{
									label: 'Score',
									value: (data) => {
										const value = (data as { score?: number }).score;
										if (value === undefined || !Number.isFinite(value)) return null;
										return value.toFixed(2);
									}
								},
								{
									label: 'Total players',
									value: (data) => formatNumber((data as { totalPlayers?: number }).totalPlayers)
								}
							]}
						/>
					{/snippet}
				</ScatterChart>
			</Chart.Container>
		{/if}
	{/snippet}
	{#snippet scoreSection({ showHelp }: { showHelp: boolean })}
		<Card.Header class="flex items-start justify-between gap-3">
			<div>
				<Card.Title class="text-base">Score vs participation</Card.Title>
				<Card.Description>Higher participation tends to lift scores.</Card.Description>
			</div>
			{#if showHelp || scoreZoomX !== null || scoreZoomY !== null}
				<div
					class="pointer-events-none flex items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
				>
					{#if scoreZoomX !== null || scoreZoomY !== null}
						<button
							type="button"
							class={iconButtonClass}
							aria-label="Clear zoom"
							onclick={() => {
								scoreZoomX = null;
								scoreZoomY = null;
							}}
						>
							<XIcon class="h-4 w-4" />
						</button>
					{/if}
					{#if showHelp}
						<GraphHelpSheet
							title="Score vs participation"
							preview={scorePreview as import('svelte').Snippet<[]>}
							class={iconButtonClass}
						>
							<p class={helpHeadingClass}>How to read</p>
							<p>
								Each dot is a session. Right means more clan participation in the lobby, up means a
								higher score. Bigger dots mean more total players.
							</p>
							<p>This reveals whether higher participation tends to correlate with score.</p>
							<ul class="list-disc pl-4">
								<li>Up means higher scores.</li>
								<li>Bigger dots mean more total players.</li>
							</ul>
							{#if scoreSummary}
								<p class={`${helpHeadingClass} mt-3`}>What this data says</p>
								<p>
									<button
										type="button"
										class="cursor-pointer"
										onmouseenter={() => (activeScoreMode = 'avg')}
										onmouseleave={() => (activeScoreMode = null)}
										onfocus={() => (activeScoreMode = 'avg')}
										onblur={() => (activeScoreMode = null)}
									>
										Average participation is about
										<span
											class="font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
										>
											{formatPercent(scoreSummary.avgParticipation * 100)}
										</span>
										of the lobby.
									</button>
								</p>
								<p>
									Sessions above the median participation average {formatRatio(
										scoreSummary.highAvg
									)}
									score, while lower-participation sessions average {formatRatio(
										scoreSummary.lowAvg
									)}.
								</p>
								<p>
									<button
										type="button"
										class="cursor-pointer"
										onmouseenter={() => (activeScoreMode = 'delta')}
										onmouseleave={() => (activeScoreMode = null)}
										onfocus={() => (activeScoreMode = 'delta')}
										onblur={() => (activeScoreMode = null)}
									>
										The high-participation sessions score
										<span
											class="font-semibold text-foreground/90 underline decoration-dotted underline-offset-4 hover:text-foreground"
										>
											{formatRatio(scoreSummary.delta)}
										</span>
										points higher on average.
									</button>
								</p>
							{/if}
						</GraphHelpSheet>
					{/if}
				</div>
			{/if}
		</Card.Header>
		<Card.Content>
			{@render (scoreChart as import('svelte').Snippet<[]>)()}
		</Card.Content>
	{/snippet}
	{#snippet scorePreview()}
		{@render (scoreSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({
			showHelp: false
		})}
	{/snippet}
	{@render (scoreSection as import('svelte').Snippet<[{ showHelp: boolean }]>)({ showHelp: true })}
</Card.Root>
