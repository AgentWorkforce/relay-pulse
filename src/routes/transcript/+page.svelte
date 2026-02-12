<script lang="ts">
	import AnimatedFlow from '$lib/components/AnimatedFlow.svelte';
	import type { Message } from '$lib/data/parser';

	const API_BASE = 'https://api.relaycast.dev';

	// Form state
	let apiKey = '';
	let channel = 'general';
	let limit = 100;

	// Data state
	let messages: Message[] = [];
	let loading = false;
	let error: string | null = null;
	let fetched = false;

	// Playback state
	let speed = 1;
	let isPaused = false;

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
	let expandedMessageId: string | null = null;
	const maxRecentMessages = 10;

	function handleMessage(event: CustomEvent<RecentMessage>) {
		recentMessages = [event.detail, ...recentMessages].slice(0, maxRecentMessages);
	}

	function truncateBody(body: string, maxLen: number = 100): string {
		if (body.length <= maxLen) return body;
		return body.substring(0, maxLen) + '...';
	}

	const speedOptions = [0.5, 1, 2, 4];

	async function fetchTranscript() {
		if (!apiKey.trim()) {
			error = 'API key is required';
			return;
		}

		loading = true;
		error = null;
		messages = [];
		recentMessages = [];
		fetched = false;

		try {
			// 1. Register a temporary agent to get an agent token
			const regRes = await fetch(`${API_BASE}/v1/agents`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${apiKey.trim()}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					name: `pulse-${Date.now().toString(36)}`,
					type: 'agent',
				}),
			});

			if (!regRes.ok) {
				const body = await regRes.text();
				throw new Error(`Agent registration failed (${regRes.status}): ${body}`);
			}

			const regData = await regRes.json();
			const agentToken = regData.data?.token;
			if (!agentToken) {
				throw new Error('No agent token in registration response');
			}

			// 2. Fetch agents list to build id→name map
			const agentsRes = await fetch(`${API_BASE}/v1/agents`, {
				headers: { 'Authorization': `Bearer ${apiKey.trim()}` },
			});
			const agentMap = new Map<string, string>();
			if (agentsRes.ok) {
				const agentsData = await agentsRes.json();
				for (const a of agentsData.data ?? []) {
					agentMap.set(a.id, a.name);
				}
			}

			// 3. Fetch messages from the channel
			const params = new URLSearchParams({ limit: String(limit) });
			const msgRes = await fetch(
				`${API_BASE}/v1/channels/${encodeURIComponent(channel.trim())}/messages?${params}`,
				{
					headers: {
						'Authorization': `Bearer ${agentToken}`,
						'Content-Type': 'application/json',
					},
				},
			);

			if (!msgRes.ok) {
				const body = await msgRes.text();
				throw new Error(`Failed to fetch messages (${msgRes.status}): ${body}`);
			}

			const msgData = await msgRes.json();
			const rawMessages: Message[] = (msgData.data ?? []).map((m: Record<string, unknown>) => {
				const agentName = agentMap.get(m.agent_id as string) ?? (m.agent_name as string) ?? 'unknown';
				const createdAt = m.created_at as string;
				return {
					id: m.id as string,
					ts: new Date(createdAt).getTime(),
					from: agentName,
					to: `#${channel.trim()}`,
					kind: 'message',
					body: (m.text as string) ?? '',
					status: 'read',
					is_urgent: false,
					is_broadcast: true,
				} satisfies Message;
			});

			// Messages come newest-first from the API, reverse to chronological
			rawMessages.reverse();
			messages = rawMessages;
			fetched = true;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			loading = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			fetchTranscript();
		}
	}
</script>

<svelte:head>
	<title>Relay Pulse - Relaycast Transcript</title>
	<meta name="description" content="Fetch and visualize Relaycast channel transcripts with animated particle flows" />
</svelte:head>

<div class="min-h-screen bg-slate-900 text-white">
	<!-- Header -->
	<header class="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-700">
		<div class="max-w-7xl mx-auto px-6 py-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-4">
					<a href="/" class="text-2xl font-bold text-white flex items-center gap-3 hover:text-emerald-400 transition-colors">
						<svg class="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
						</svg>
						Relay Pulse
					</a>
					<span class="text-sm text-slate-500">|</span>
					<span class="text-sm text-slate-400">Relaycast Transcript</span>
					{#if fetched}
						<span class="text-sm text-slate-500">|</span>
						<span class="text-sm text-slate-400">{messages.length} messages</span>
					{/if}
				</div>

				{#if fetched}
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
				{/if}
			</div>
		</div>
	</header>

	<main class="max-w-7xl mx-auto px-6 py-6">
		{#if !fetched}
			<!-- Input form -->
			<div class="max-w-2xl mx-auto mt-12">
				<div class="text-center mb-8">
					<h2 class="text-2xl font-bold text-slate-100 mb-2">Fetch Relaycast Transcript</h2>
					<p class="text-slate-400 text-sm">
						Enter your workspace API key and channel name to visualize agent message history.
					</p>
				</div>

				<div class="bg-slate-800/50 rounded-lg border border-slate-700 p-6 space-y-4">
					<div>
						<label for="api-key" class="block text-sm font-medium text-slate-300 mb-1.5">
							API Key
						</label>
						<input
							id="api-key"
							type="password"
							bind:value={apiKey}
							on:keydown={handleKeydown}
							placeholder="rk_live_..."
							class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
						/>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="channel" class="block text-sm font-medium text-slate-300 mb-1.5">
								Channel
							</label>
							<input
								id="channel"
								type="text"
								bind:value={channel}
								on:keydown={handleKeydown}
								placeholder="general"
								class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
							/>
						</div>
						<div>
							<label for="limit" class="block text-sm font-medium text-slate-300 mb-1.5">
								Message Limit
							</label>
							<input
								id="limit"
								type="number"
								bind:value={limit}
								on:keydown={handleKeydown}
								min={1}
								max={500}
								class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
							/>
						</div>
					</div>

					<button
						on:click={fetchTranscript}
						disabled={loading}
						class="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
					>
						{loading ? 'Fetching...' : 'Fetch & Visualize'}
					</button>

					{#if error}
						<div class="px-3 py-2 bg-red-900/30 border border-red-700/50 rounded-md text-red-300 text-sm">
							{error}
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<!-- Animated Flow + Sidebar -->
			<div class="flex gap-6">
				<!-- Canvas Area -->
				<div class="flex-1 h-[calc(100vh-200px)] min-h-[500px]">
					<AnimatedFlow
						{messages}
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
						<h4 class="text-sm font-medium text-slate-300">#{channel} Feed</h4>
						<div class="flex items-center gap-2">
							{#if isPaused}
								<span class="text-xs text-cyan-400 flex items-center gap-1">
									<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
										<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
									</svg>
									Paused
								</span>
							{/if}
							<button
								class="text-xs text-slate-500 hover:text-slate-300 transition-colors"
								on:click={() => { fetched = false; messages = []; recentMessages = []; }}
							>
								New fetch
							</button>
						</div>
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
		{/if}
	</main>

	<!-- Footer -->
	<footer class="border-t border-slate-700 px-6 py-4">
		<div class="max-w-7xl mx-auto flex items-center justify-between text-slate-500 text-sm">
			<span>Relay Pulse - Agent Message Visualization</span>
			<a href="https://github.com/AgentWorkforce/relay-broker" target="_blank" rel="noopener" class="hover:text-slate-300 transition-colors">
				Powered by Agent Relay
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
