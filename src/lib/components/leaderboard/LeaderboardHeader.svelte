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

	let searchOpen = $state(false);
	let searchInputEl = $state<HTMLInputElement | null>(null);
	let searchContentEl = $state<HTMLDivElement | null>(null);
	let searchDropdownWidth = $state(0);
	let ignoreSearchBlur = $state(false);
	let focusFromPointer = $state(false);
	const isDarkMode = $derived.by(() => (mode.current ? mode.current === 'dark' : true));

	const handleSuggestionSelect = (value: string) => {
		search = value;
		searchOpen = false;
	};

	const openSearch = () => {
		searchOpen = true;
	};

	const handleSearchPointerDown = () => {
		focusFromPointer = true;
	};

	const handleSearchFocus = () => {
		updateSearchDropdownWidth();
		if (!focusFromPointer) {
			openSearch();
		}
		focusFromPointer = false;
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
		if (searchSuggestions.length === 0) return;
		event.preventDefault();
		if (!searchOpen) openSearch();
		ignoreSearchBlur = true;
		setTimeout(() => {
			searchContentEl?.querySelector<HTMLButtonElement>('button')?.focus();
		}, 0);
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

	$effect(() => {
		updateSearchDropdownWidth();
		if (!searchInputEl || !('ResizeObserver' in window)) return;
		const observer = new ResizeObserver(() => updateSearchDropdownWidth());
		observer.observe(searchInputEl);
		return () => observer.disconnect();
	});
</script>

<header
	class="relative flex flex-col gap-3 overflow-hidden bg-background aspect-[1536/436] min-h-56 max-sm:aspect-auto max-sm:min-h-0"
>
	<div
		class="pointer-events-none absolute inset-0 z-10 bg-[url('/images/ambient_header.png')] bg-cover bg-no-repeat [background-position:right_40%] [mask-image:linear-gradient(to_bottom,_rgba(0,0,0,1)_0%,_rgba(0,0,0,1)_72%,_rgba(0,0,0,0)_100%)] max-lg:[background-position:right_45%] max-sm:top-auto max-sm:bottom-0 max-sm:h-[6.5rem] max-sm:opacity-50 max-sm:[background-position:right_bottom] max-sm:[mask-image:linear-gradient(to_top,_rgba(0,0,0,1)_0%,_rgba(0,0,0,1)_55%,_rgba(0,0,0,0)_100%)] max-[420px]:hidden"
		aria-hidden="true"
	>
		<div
			class="pointer-events-none absolute inset-0 bg-[url('/images/ambient_header.png')] bg-cover bg-no-repeat [background-position:right_40%] blur-[18px] opacity-55 [mask-image:linear-gradient(to_bottom,_rgba(0,0,0,0)_0%,_rgba(0,0,0,0)_65%,_rgba(0,0,0,1)_100%)] max-lg:[background-position:right_45%] max-sm:top-auto max-sm:bottom-0 max-sm:h-[7.5rem] max-sm:opacity-35 max-sm:[background-position:right_bottom] max-sm:[mask-image:linear-gradient(to_top,_rgba(0,0,0,0)_0%,_rgba(0,0,0,1)_70%)]"
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
					<h1 class="text-3xl font-semibold tracking-tight">OpenFrontInsights</h1>
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
					aria-label="Clan search"
					onkeydowncapture={handleSearchTab}
				>
					<Popover.Root bind:open={searchOpen}>
						<Popover.Trigger>
							{#snippet child({ props })}
								<Input.Root
									{...props}
									id="search-clan-top"
									autocomplete="off"
									class="w-full md:w-56"
									placeholder="Search by clan tag"
									bind:value={search}
									bind:ref={searchInputEl}
									onpointerdown={handleSearchPointerDown}
									onfocus={handleSearchFocus}
									oninput={openSearch}
									onblur={handleSearchBlur}
									onkeydown={handleSearchTab}
								/>
							{/snippet}
						</Popover.Trigger>
						<Popover.Content
							align="end"
							trapFocus={false}
							onOpenAutoFocus={(event) => event.preventDefault()}
							onCloseAutoFocus={(event) => event.preventDefault()}
							bind:ref={searchContentEl}
							style={`width: ${searchDropdownWidth}px; min-width: ${searchDropdownWidth}px;`}
							class="max-h-64 overflow-y-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
						>
							<div
								role="listbox"
								aria-label="Search suggestions"
								tabindex="-1"
								onkeydown={handleSuggestionKeydown}
							>
								{#if searchSuggestions.length === 0}
									<div class="px-2 py-1.5 text-sm text-muted-foreground">No clans found.</div>
								{:else}
									{#each searchSuggestions as suggestion, idx (suggestion + idx)}
										<button
											type="button"
											class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
											onclick={() => handleSuggestionSelect(suggestion)}
											onkeydown={(event) => {
												if (event.key === 'Tab' && event.shiftKey && idx === 0) {
													event.preventDefault();
													searchInputEl?.focus();
												}
											}}
										>
											<span>{suggestion}</span>
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
