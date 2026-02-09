<script lang="ts">
	import * as Button from '$lib/components/ui/button';
	import * as Input from '$lib/components/ui/input';
	import * as Popover from '$lib/components/ui/popover';
	import { Badge } from '$lib/components/ui/badge';
	import { mode, toggleMode } from 'mode-watcher';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import CalendarRangeIcon from '@lucide/svelte/icons/calendar-range';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import GithubIcon from '@lucide/svelte/icons/github';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import {
		addRecentlyViewed,
		getRecentlyViewed,
		setRecentlyViewedLabel,
		type RecentlyViewedItem
	} from '$lib/leaderboard/recently-viewed';

	let {
		renderDateRange,
		renderLastUpdated,
		search = $bindable(''),
		searchSuggestions = [],
		onRefresh = () => {}
	} = $props<{
		renderDateRange: () => string;
		renderLastUpdated: () => string;
		search?: string;
		searchSuggestions?: string[];
		onRefresh?: () => void;
	}>();

	type HeaderSuggestion = {
		key: string;
		value: string;
		label: string;
		description?: string;
		kind: 'clan' | 'player';
	};

	type PlayerLookupResponse = {
		playerId: string;
		username: string | null;
		globalName: string | null;
	};

	let searchOpen = $state(false);
	let searchInputEl = $state<HTMLInputElement | null>(null);
	let searchContentEl = $state<HTMLDivElement | null>(null);
	let searchDropdownWidth = $state(0);
	let ignoreSearchBlur = $state(false);
	let playerSuggestion = $state<HeaderSuggestion | null>(null);
	let playerLookupLoading = $state(false);
	let recentlyViewed = $state<RecentlyViewedItem[]>([]);
	let playerLookupAbort: AbortController | null = null;
	let playerLookupRequestId = 0;
	const playerLookupCache = new SvelteMap<string, PlayerLookupResponse | null>();
	const recentLabelLookupInFlight: Record<string, true> = Object.create(null);
	const isDarkMode = $derived.by(() => (mode.current ? mode.current === 'dark' : true));
	const recentlyViewedLimit = 8;
	const sameRecentlyViewed = (left: RecentlyViewedItem[], right: RecentlyViewedItem[]) => {
		if (left.length !== right.length) return false;
		for (let index = 0; index < left.length; index += 1) {
			const a = left[index];
			const b = right[index];
			if (a.kind !== b.kind || a.id !== b.id || a.label !== b.label || a.viewedAt !== b.viewedAt) {
				return false;
			}
		}
		return true;
	};

	const updateRecentlyViewed = () => {
		const next = getRecentlyViewed(recentlyViewedLimit);
		if (!sameRecentlyViewed(recentlyViewed, next)) {
			recentlyViewed = next;
		}
	};

	const handleSuggestionSelect = (suggestion: HeaderSuggestion) => {
		searchOpen = false;
		if (suggestion.kind === 'player') {
			navigateToPlayer(suggestion.value);
			return;
		}
		navigateToClan(suggestion.value);
	};

	const normalizeClanTag = (value: string) => value.trim().replace(/^\[|\]$/g, '');
	const playerIdPattern = /^[1-9A-HJ-NP-Za-km-z]{8}$/;

	const isPlayerId = (value: string) => playerIdPattern.test(value.trim());

	const toClanSuggestion = (value: string): HeaderSuggestion => ({
		key: `clan:${value}`,
		value,
		label: value,
		description: 'Clan',
		kind: 'clan'
	});
	const toPlayerSuggestion = (payload: PlayerLookupResponse): HeaderSuggestion => {
		const label = payload.globalName ?? payload.username ?? payload.playerId;
		const descriptionName =
			payload.globalName && payload.username && payload.globalName !== payload.username
				? `@${payload.username}`
				: payload.username
					? `@${payload.username}`
					: undefined;
		return {
			key: `player:${payload.playerId}`,
			value: payload.playerId,
			label,
			description: descriptionName ? `Player ${descriptionName}` : 'Player',
			kind: 'player'
		};
	};
	const toRecentSuggestion = (item: RecentlyViewedItem): HeaderSuggestion => {
		if (item.kind === 'clan') {
			return {
				key: `recent:clan:${item.id}`,
				value: item.id,
				label: item.id,
				description: 'Recent clan',
				kind: 'clan'
			};
		}

		const label = String(item.label ?? '').trim() || item.id;
		return {
			key: `recent:player:${item.id}`,
			value: item.id,
			label,
			description: 'Recent player',
			kind: 'player'
		};
	};

	const resolveRecentPlayerLabel = async (playerId: string) => {
		const id = playerId.trim();
		if (!id || recentLabelLookupInFlight[id]) return;
		recentLabelLookupInFlight[id] = true;

		try {
			let payload = playerLookupCache.get(id);
			if (payload === undefined) {
				const response = await fetch(`/api/players/${encodeURIComponent(id)}/lookup`);
				if (!response.ok) {
					if (response.status === 404) {
						playerLookupCache.set(id, null);
					}
					return;
				}
				payload = (await response.json()) as PlayerLookupResponse;
				playerLookupCache.set(id, payload);
			}

			const username = payload?.username?.trim();
			if (!username) return;
			const update = setRecentlyViewedLabel(
				{ kind: 'player', id, label: username },
				recentlyViewedLimit
			);
			if (update.changed) {
				recentlyViewed = update.items;
			}
		} catch (err) {
			console.error(`Failed to resolve recent player username for ${id}`, err);
		} finally {
			delete recentLabelLookupInFlight[id];
		}
	};

	const navigateToClan = (value: string) => {
		const cleaned = normalizeClanTag(value);
		if (!cleaned) return;
		const tag = cleaned.toUpperCase();
		recentlyViewed = addRecentlyViewed({ kind: 'clan', id: tag, label: tag }, recentlyViewedLimit);
		searchOpen = false;
		void goto(resolve(`/clans/${encodeURIComponent(tag)}`));
	};

	const navigateToPlayer = (value: string) => {
		const cleaned = value.trim();
		if (!cleaned) return;
		const cachedPlayer = playerLookupCache.get(cleaned) ?? null;
		const playerLabel = cachedPlayer?.username?.trim() || null;
		if (playerLabel) {
			recentlyViewed = addRecentlyViewed(
				{ kind: 'player', id: cleaned, label: playerLabel },
				recentlyViewedLimit
			);
		}
		searchOpen = false;
		void goto(resolve(`/players/${encodeURIComponent(cleaned)}`));
	};

	const navigateFromSearch = (value: string) => {
		if (isPlayerId(value)) {
			navigateToPlayer(value);
			return;
		}
		navigateToClan(value);
	};

	const resolvePlayerSuggestion = (playerId: string, payload: PlayerLookupResponse | null) => {
		if (search.trim() !== playerId) return;
		playerSuggestion = payload ? toPlayerSuggestion(payload) : null;
	};

	const lookupPlayerSuggestion = async (playerId: string) => {
		const trimmed = playerId.trim();
		if (!isPlayerId(trimmed)) {
			playerSuggestion = null;
			playerLookupLoading = false;
			return;
		}

		const cached = playerLookupCache.get(trimmed);
		if (cached !== undefined) {
			resolvePlayerSuggestion(trimmed, cached);
			playerLookupLoading = false;
			return;
		}

		playerLookupRequestId += 1;
		const requestId = playerLookupRequestId;
		playerLookupAbort?.abort();
		const controller = new AbortController();
		playerLookupAbort = controller;
		playerLookupLoading = true;

		try {
			const response = await fetch(`/api/players/${encodeURIComponent(trimmed)}/lookup`, {
				signal: controller.signal
			});
			if (!response.ok) {
				if (response.status === 404) {
					playerLookupCache.set(trimmed, null);
					resolvePlayerSuggestion(trimmed, null);
					return;
				}
				throw new Error(`Player lookup failed ${response.status}`);
			}
			const payload = (await response.json()) as PlayerLookupResponse;
			if (requestId !== playerLookupRequestId) return;
			playerLookupCache.set(trimmed, payload);
			resolvePlayerSuggestion(trimmed, payload);
		} catch (err) {
			if (controller.signal.aborted || requestId !== playerLookupRequestId) return;
			console.error(`Failed to lookup player id ${trimmed}`, err);
			playerLookupCache.set(trimmed, null);
			resolvePlayerSuggestion(trimmed, null);
		} finally {
			if (requestId === playerLookupRequestId) {
				playerLookupLoading = false;
			}
		}
	};

	const openSearch = () => {
		updateRecentlyViewed();
		searchOpen = true;
	};

	const handleSearchFocus = () => {
		updateSearchDropdownWidth();
		openSearch();
	};

	const handleSearchBlur = () => {
		if (ignoreSearchBlur) {
			ignoreSearchBlur = false;
			return;
		}
		setTimeout(() => {
			const active = document.activeElement as Node | null;
			if (searchInputEl?.contains(active)) return;
			if (searchContentEl?.contains(active)) return;
			searchOpen = false;
		}, 0);
	};

	const updateSearchDropdownWidth = () => {
		searchDropdownWidth = searchInputEl?.offsetWidth ?? 0;
	};

	const handleSearchTab = (event: KeyboardEvent) => {
		if (event.key !== 'Tab' || event.shiftKey) return;
		if (activeSuggestions.length === 0) return;
		event.preventDefault();
		if (!searchOpen) openSearch();
		ignoreSearchBlur = true;
		setTimeout(() => {
			searchContentEl?.querySelector<HTMLButtonElement>('button')?.focus();
		}, 0);
	};

	const handleSearchKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			navigateFromSearch(search);
			return;
		}
		handleSearchTab(event);
	};

	const handleSuggestionKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Escape') {
			searchOpen = false;
			searchInputEl?.focus();
			return;
		}
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.key === 'Backspace') {
			event.preventDefault();
			search = search.slice(0, -1);
			searchInputEl?.focus();
			return;
		}
		if (event.key.length === 1) {
			event.preventDefault();
			search += event.key;
			searchInputEl?.focus();
		}
	};

	const normalizedSuggestions = $derived.by(() => {
		const clanSuggestions: HeaderSuggestion[] = searchSuggestions.map(toClanSuggestion);
		const selectedPlayer = playerSuggestion;
		if (!selectedPlayer) return clanSuggestions;
		if (
			clanSuggestions.some((suggestion: HeaderSuggestion) => suggestion.key === selectedPlayer.key)
		) {
			return clanSuggestions;
		}
		return [selectedPlayer, ...clanSuggestions];
	});
	const searchTerm = $derived.by(() => search.trim());
	const recentSuggestions = $derived.by(() =>
		searchTerm === '' ? recentlyViewed.map(toRecentSuggestion) : []
	);
	const showingRecentSuggestions = $derived.by(() => searchTerm === '' && recentSuggestions.length > 0);
	const activeSuggestions = $derived.by(() =>
		showingRecentSuggestions ? recentSuggestions : normalizedSuggestions
	);

	onMount(() => {
		updateRecentlyViewed();
	});

	$effect(() => {
		for (const item of recentlyViewed) {
			if (item.kind !== 'player') continue;
			if (item.label.trim() !== item.id) continue;
			void resolveRecentPlayerLabel(item.id);
		}
	});

	$effect(() => {
		updateSearchDropdownWidth();
		if (!searchInputEl || !('ResizeObserver' in window)) return;
		const observer = new ResizeObserver(() => updateSearchDropdownWidth());
		observer.observe(searchInputEl);
		return () => observer.disconnect();
	});

	$effect(() => {
		const target = search.trim();
		if (!isPlayerId(target)) {
			playerLookupAbort?.abort();
			playerLookupLoading = false;
			playerSuggestion = null;
			return;
		}

		const timeoutId = setTimeout(() => {
			void lookupPlayerSuggestion(target);
		}, 150);
		return () => clearTimeout(timeoutId);
	});
</script>

<header
	class="relative flex aspect-[1536/436] min-h-56 flex-col gap-3 overflow-hidden bg-background max-sm:aspect-auto max-sm:min-h-0"
>
	<div
		class="pointer-events-none absolute inset-0 z-10 bg-[url('/images/ambient_header.png')] [mask-image:linear-gradient(to_bottom,_rgba(0,0,0,1)_0%,_rgba(0,0,0,1)_72%,_rgba(0,0,0,0)_100%)] bg-cover [background-position:right_40%] bg-no-repeat max-[420px]:hidden max-lg:[background-position:right_45%] max-sm:top-auto max-sm:bottom-0 max-sm:h-[6.5rem] max-sm:[mask-image:linear-gradient(to_top,_rgba(0,0,0,1)_0%,_rgba(0,0,0,1)_55%,_rgba(0,0,0,0)_100%)] max-sm:[background-position:right_bottom] max-sm:opacity-50"
		aria-hidden="true"
	>
		<div
			class="pointer-events-none absolute inset-0 bg-[url('/images/ambient_header.png')] [mask-image:linear-gradient(to_bottom,_rgba(0,0,0,0)_0%,_rgba(0,0,0,0)_65%,_rgba(0,0,0,1)_100%)] bg-cover [background-position:right_40%] bg-no-repeat opacity-55 blur-[18px] max-lg:[background-position:right_45%] max-sm:top-auto max-sm:bottom-0 max-sm:h-[7.5rem] max-sm:[mask-image:linear-gradient(to_top,_rgba(0,0,0,0)_0%,_rgba(0,0,0,1)_70%)] max-sm:[background-position:right_bottom] max-sm:opacity-35"
			aria-hidden="true"
		></div>
	</div>
	<div
		class="absolute inset-0 z-20 flex flex-col gap-3 py-3 max-sm:relative max-sm:pt-[0.85rem] max-sm:pb-4"
	>
		<div
			class="flex w-full flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start"
		>
			<div class="space-y-1">
				<div class="flex flex-wrap items-center gap-3">
					<h1 class="text-3xl font-semibold tracking-tight">
						<a
							href={resolve('/')}
							class="inline-flex items-center transition-colors hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
							aria-label="OpenFrontInsights home"
						>
							OpenFrontInsights
						</a>
					</h1>
					<a
						class="inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
						href="https://github.com/Ezbaze/OpenFrontInsights"
						rel="noreferrer"
						target="_blank"
						aria-label="OpenFrontInsights on GitHub"
					>
						<GithubIcon class="size-4" />
					</a>
				</div>
				<p class="text-sm text-muted-foreground">
					Top 100 clans ranked by weighted wins from
					<a
						class="font-semibold text-foreground/80 transition-colors hover:text-foreground"
						href="https://openfront.io/"
						rel="noreferrer"
						target="_blank"
					>
						OpenFront
					</a>
					.
				</p>
				<div class="header-pills flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
					<Badge variant="outline" class="flex items-center gap-1.5 text-xs">
						<CalendarRangeIcon class="size-3.5" />
						<span>{renderDateRange()}</span>
					</Badge>
					<Badge variant="outline" class="flex items-center gap-1.5 text-xs">
						<ClockIcon class="size-3.5" />
						<span>{renderLastUpdated()}</span>
					</Badge>
				</div>
			</div>
			<div
				class="leaderboard-header-actions flex w-full items-center gap-2 lg:w-auto lg:justify-end"
			>
				<div
					class="min-w-0 flex-1"
					role="group"
					aria-label="Clan navigation"
					onkeydowncapture={handleSearchTab}
				>
					<Popover.Root bind:open={searchOpen}>
						<Input.Root
							id="search-clan-top"
							type="text"
							autocomplete="off"
							class="w-full md:w-56"
							placeholder="Jump to clan tag or player id"
							role="combobox"
							aria-autocomplete="list"
							aria-label="Jump to clan tag or player id"
							aria-controls="search-clan-suggestions"
							aria-expanded={searchOpen}
							aria-haspopup="listbox"
							bind:value={search}
							bind:ref={searchInputEl}
							onfocus={handleSearchFocus}
							oninput={openSearch}
							onblur={handleSearchBlur}
							onkeydown={handleSearchKeydown}
						/>
						<Popover.Content
							align="end"
							trapFocus={false}
							customAnchor={searchInputEl}
							onOpenAutoFocus={(event) => event.preventDefault()}
							onCloseAutoFocus={(event) => event.preventDefault()}
							bind:ref={searchContentEl}
							style={`width: ${searchDropdownWidth}px; min-width: ${searchDropdownWidth}px;`}
							class="max-h-64 overflow-y-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
						>
							<div
								id="search-clan-suggestions"
								role="listbox"
								aria-label="Search suggestions"
								tabindex="-1"
								onkeydown={handleSuggestionKeydown}
							>
								{#if activeSuggestions.length === 0}
									<div
										role="status"
										aria-live="polite"
										class="px-2 py-1.5 text-sm text-muted-foreground"
									>
										{#if playerLookupLoading}
											Checking player id...
										{:else}
											No matches found.
										{/if}
									</div>
								{:else}
									{#if showingRecentSuggestions}
										<div class="px-2 py-1 text-xs font-medium text-muted-foreground">
											<span class="inline-flex items-center gap-1">
												<ClockIcon class="size-3.5" />
												Recently viewed
											</span>
										</div>
									{/if}
									{#each activeSuggestions as suggestion, idx (suggestion.key)}
										<button
											type="button"
											role="option"
											id={`search-suggestion-${idx}`}
											aria-selected="false"
											class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
											onclick={() => handleSuggestionSelect(suggestion)}
											onkeydown={(event) => {
												if (event.key === 'Tab' && event.shiftKey && idx === 0) {
													event.preventDefault();
													searchInputEl?.focus();
												}
											}}
										>
											<span>{suggestion.label}</span>
											{#if suggestion.description}
												<span class="text-xs text-muted-foreground">{suggestion.description}</span>
											{/if}
										</button>
									{/each}
								{/if}
							</div>
						</Popover.Content>
					</Popover.Root>
				</div>
				<Button.Root
					variant="outline"
					size="icon"
					aria-label="Refresh leaderboard"
					onclick={onRefresh}
				>
					<RefreshCwIcon class="size-4" />
					<span class="sr-only">Refresh</span>
				</Button.Root>
				<Button.Root
					variant="outline"
					size="icon"
					aria-label="Toggle dark mode"
					onclick={toggleMode}
				>
					{#if isDarkMode}
						<SunIcon class="size-4" />
						<span class="sr-only">Switch to light mode</span>
					{:else}
						<MoonIcon class="size-4" />
						<span class="sr-only">Switch to dark mode</span>
					{/if}
				</Button.Root>
			</div>
		</div>
	</div>
</header>
