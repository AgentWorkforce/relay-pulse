<script lang="ts">
	import { onDestroy } from 'svelte';
	import AnimatedFlow from '$lib/components/AnimatedFlow.svelte';

	export let data;

	// Playback state
	let speed = 1;

	// Message feed state
	interface RecentMessage {
		id: string;
		from: string;
		to: string;
		body: string;
		color: string;
		timestamp: number;
	}
	let recentMessages: RecentMessage[] = [];
	let isPaused = false;
	let expandedMessageId: string | null = null;
	const maxRecentMessages = 10;

	function handleMessage(event: CustomEvent<RecentMessage>) {
		recentMessages = [event.detail, ...recentMessages].slice(0, maxRecentMessages);
	}

	function truncateBody(body: string, maxLen: number = 100): string {
		if (body.length <= maxLen) return body;
		return body.substring(0, maxLen) + '...';
	}

	// Speed options
	const speedOptions = [0.5, 1, 2, 4];

	$: totalMessages = data.messages.length;
</script>

<svelte:head>
	<title>Relay Pulse - Agent Message Flow Visualization</title>
	<meta name="description" content="Visualize agent-to-agent communication in real-time with animated particle flows" />
</svelte:head>

<div class="min-h-screen bg-slate-900 text-white">
	<!-- Header -->
	<header class="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-700">
		<div class="max-w-7xl mx-auto px-6 py-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-4">
					<h1 class="text-2xl font-bold text-white flex items-center gap-3">
						<svg class="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
						</svg>
						Relay Pulse
					</h1>
					<span class="text-sm text-slate-500">|</span>
					<span class="text-sm text-slate-400">{totalMessages} messages</span>
				</div>

				<!-- Speed Controls -->
				<div class="flex items-center gap-3">
					<span class="text-sm text-slate-400">Speed:</span>
					<div class="flex gap-1">
						{#each speedOptions as s}
							<button
								class="px-3 py-1.5 rounded text-sm font-medium transition-colors {speed === s ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'}"
								on:click={() => speed = s}
							>
								{s}x
							</button>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="max-w-7xl mx-auto px-6 py-6">
		<div class="flex gap-6">
			<!-- Canvas Area -->
			<div class="flex-1 h-[calc(100vh-200px)] min-h-[500px]">
				<AnimatedFlow
					messages={data.messages}
					animationSpeed={speed}
					bind:isPaused
					on:message={handleMessage}
				/>
			</div>

			<!-- Message Feed Sidebar -->
			<div
				class="w-96 bg-slate-800/90 backdrop-blur rounded-lg border border-slate-700 overflow-hidden flex flex-col transition-all {isPaused ? 'ring-2 ring-cyan-500' : ''}"
				on:mouseenter={() => isPaused = true}
				on:mouseleave={() => isPaused = false}
				role="region"
				aria-label="Message feed"
			>
				<div class="px-4 py-3 border-b border-slate-700 bg-slate-900/50 flex items-center justify-between shrink-0">
					<h4 class="text-sm font-medium text-slate-300">Live Message Feed</h4>
					{#if isPaused}
						<span class="text-xs text-cyan-400 flex items-center gap-1">
							<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
								<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
							</svg>
							Paused
						</span>
					{/if}
				</div>
				<div class="flex-1 overflow-y-auto">
					{#each recentMessages as msg (msg.id)}
						<button
							class="w-full text-left px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer"
							on:click={() => expandedMessageId = expandedMessageId === msg.id ? null : msg.id}
						>
							<div class="flex items-center gap-2 mb-1">
								<span
									class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
									style="background-color: {msg.color}"
								>
									{msg.from}
								</span>
								<svg class="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
								</svg>
								<span class="text-xs text-slate-400">{msg.to}</span>
								<svg
									class="w-3 h-3 text-slate-500 ml-auto transition-transform {expandedMessageId === msg.id ? 'rotate-180' : ''}"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								</svg>
							</div>
							{#if expandedMessageId === msg.id}
								<p class="text-sm text-slate-300 whitespace-pre-wrap break-words mt-2">{msg.body}</p>
							{:else}
								<p class="text-xs text-slate-400 line-clamp-2">{truncateBody(msg.body, 100)}</p>
							{/if}
						</button>
					{/each}
					{#if recentMessages.length === 0}
						<div class="px-4 py-8 text-sm text-slate-500 text-center">
							Waiting for messages...
						</div>
					{/if}
				</div>
			</div>
		</div>
	</main>

	<!-- Footer -->
	<footer class="border-t border-slate-700 px-6 py-4">
		<div class="max-w-7xl mx-auto flex items-center justify-between text-slate-500 text-sm">
			<span>Relay Pulse - Agent Message Visualization</span>
			<a href="https://github.com/AgentWorkforce/relay" target="_blank" rel="noopener" class="hover:text-slate-300 transition-colors">
				Powered by Agent Relay Protocol
			</a>
		</div>
	</footer>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
