<script lang="ts">
	let { label, onClick, isSorted = false } = $props<{
		label: string;
		onClick: ((event: MouseEvent) => void) | undefined;
		isSorted?: false | "asc" | "desc";
	}>();
</script>

<button
	type="button"
	class="flex w-full items-center justify-between gap-2 text-left"
	onclick={onClick}
>
	<span>{label}</span>
	{#if isSorted}
		<span>{isSorted === "desc" ? "↓" : "↑"}</span>
	{/if}
</button>
