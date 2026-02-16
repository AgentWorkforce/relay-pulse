<svelte:options customElement={{ tag: 'animated-flow', shadow: 'none' }} />

<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';

	const browser = typeof window !== 'undefined';

	const dispatch = createEventDispatcher<{
		message: RecentMessage;
	}>();

	interface Message {
		id: string;
		ts: number;
		from: string;
		to: string;
		kind: string;
		body: string;
	}

	interface Props {
		messages?: Message[];
		animationSpeed?: number;
		particleSize?: number;
		showLabels?: boolean;
		showMessageFeed?: boolean;
		isPaused?: boolean;
	}

	let {
		messages = [],
		animationSpeed = 1,
		particleSize = 6,
		showLabels = true,
		showMessageFeed = false,
		isPaused = $bindable(false)
	}: Props = $props();

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let animationId: number;
	let width: number = 800;
	let height: number = 600;

	// Agent colors - consistent with other components
	const agentColors: Record<string, string> = {
		'Dashboard': '#a855f7',      // purple-500
		'Architect': '#3b82f6',      // blue-500
		'UI-Agent': '#22c55e',       // green-500
		'Backend-Agent': '#f97316',  // orange-500
		'DevOps-Agent': '#ef4444',   // red-500
		'Lead': '#eab308',           // yellow-500
		'Designer': '#ec4899',       // pink-500
		'Developer': '#06b6d4',      // cyan-500
		'DataParser': '#8b5cf6',     // violet-500
		'__system__': '#64748b'      // slate-500
	};

	function getAgentColor(agent: string): string {
		return agentColors[agent] || '#06b6d4';
	}

	// Extract unique agents from messages
	let agents = $derived([...new Set([
		...messages.map(m => m.from),
		...messages.map(m => m.to).filter(to => !to.startsWith('#'))
	])].filter(a => a !== '__system__'));

	// Node positions (calculated in circle)
	interface Node {
		id: string;
		x: number;
		y: number;
		color: string;
		radius: number;
	}

	let nodes: Node[] = [];

	// Particles for animation
	interface Particle {
		id: string;
		fromNode: Node;
		toNode: Node;
		progress: number;
		color: string;
		trail: { x: number; y: number; alpha: number }[];
		body: string;
		from: string;
		to: string;
	}

	// Recent messages for display
	interface RecentMessage {
		id: string;
		from: string;
		to: string;
		body: string;
		color: string;
		timestamp: number;
	}

	let particles: Particle[] = [];
	let recentMessages: RecentMessage[] = [];
	let messageIndex = 0;
	let lastMessageTime = 0;
	const messageInterval = 500; // ms between new particles
	const maxRecentMessages = 5;
	let expandedMessageId: string | null = null;

	function calculateNodePositions() {
		const centerX = width / 2;
		const centerY = height / 2;
		const radius = Math.min(width, height) * 0.35;

		nodes = agents.map((agent, index) => {
			const angle = (index / agents.length) * Math.PI * 2 - Math.PI / 2;
			return {
				id: agent,
				x: centerX + Math.cos(angle) * radius,
				y: centerY + Math.sin(angle) * radius,
				color: getAgentColor(agent),
				radius: 30
			};
		});
	}

	function getNodeById(id: string): Node | undefined {
		return nodes.find(n => n.id === id);
	}

	// Easing function for smooth movement
	function easeInOutCubic(t: number): number {
		return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
	}

	function truncateBody(body: string, maxLen: number = 80): string {
		if (body.length <= maxLen) return body;
		return body.substring(0, maxLen) + '...';
	}

	function spawnParticle(msg: Message) {
		const fromNode = getNodeById(msg.from);
		let toNode = getNodeById(msg.to);
		const color = getAgentColor(msg.from);

		// Add to recent messages
		const newMsg: RecentMessage = {
			id: msg.id,
			from: msg.from,
			to: msg.to,
			body: msg.body,
			color,
			timestamp: Date.now()
		};
		recentMessages = [newMsg, ...recentMessages].slice(0, maxRecentMessages);
		dispatch('message', newMsg);

		// For channel messages, pick a random recipient or broadcast effect
		if (!toNode && msg.to.startsWith('#')) {
			// Broadcast to all nodes
			nodes.forEach(node => {
				if (node.id !== msg.from) {
					particles.push({
						id: `${msg.id}-${node.id}`,
						fromNode: fromNode!,
						toNode: node,
						progress: 0,
						color,
						trail: [],
						body: msg.body,
						from: msg.from,
						to: node.id
					});
				}
			});
			return;
		}

		if (fromNode && toNode) {
			particles.push({
				id: msg.id,
				fromNode,
				toNode,
				progress: 0,
				color,
				trail: [],
				body: msg.body,
				from: msg.from,
				to: msg.to
			});
		}
	}

	function updateParticles(deltaTime: number) {
		const speed = 0.001 * animationSpeed;

		particles = particles.filter(particle => {
			particle.progress += speed * deltaTime;

			// Calculate current position
			const easedProgress = easeInOutCubic(Math.min(particle.progress, 1));
			const x = particle.fromNode.x + (particle.toNode.x - particle.fromNode.x) * easedProgress;
			const y = particle.fromNode.y + (particle.toNode.y - particle.fromNode.y) * easedProgress;

			// Add to trail
			particle.trail.push({ x, y, alpha: 1 });

			// Fade trail
			particle.trail = particle.trail
				.map(t => ({ ...t, alpha: t.alpha - 0.02 }))
				.filter(t => t.alpha > 0);

			// Keep only last 20 trail points
			if (particle.trail.length > 20) {
				particle.trail = particle.trail.slice(-20);
			}

			return particle.progress < 1;
		});
	}

	function draw() {
		if (!ctx) return;

		// Clear canvas with dark background
		ctx.fillStyle = '#0f172a'; // slate-900
		ctx.fillRect(0, 0, width, height);

		// Draw connections (subtle lines between all nodes)
		ctx.strokeStyle = 'rgba(71, 85, 105, 0.2)'; // slate-600 with low opacity
		ctx.lineWidth = 1;
		nodes.forEach((node, i) => {
			nodes.slice(i + 1).forEach(other => {
				ctx.beginPath();
				ctx.moveTo(node.x, node.y);
				ctx.lineTo(other.x, other.y);
				ctx.stroke();
			});
		});

		// Draw particle trails
		particles.forEach(particle => {
			particle.trail.forEach((point, i) => {
				const size = (particleSize * 0.5) * (i / particle.trail.length);
				ctx.beginPath();
				ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
				ctx.fillStyle = particle.color + Math.floor(point.alpha * 80).toString(16).padStart(2, '0');
				ctx.fill();
			});
		});

		// Draw particles (glowing effect)
		particles.forEach(particle => {
			const easedProgress = easeInOutCubic(Math.min(particle.progress, 1));
			const x = particle.fromNode.x + (particle.toNode.x - particle.fromNode.x) * easedProgress;
			const y = particle.fromNode.y + (particle.toNode.y - particle.fromNode.y) * easedProgress;

			// Outer glow
			const gradient = ctx.createRadialGradient(x, y, 0, x, y, particleSize * 3);
			gradient.addColorStop(0, particle.color + 'cc');
			gradient.addColorStop(0.5, particle.color + '44');
			gradient.addColorStop(1, particle.color + '00');

			ctx.beginPath();
			ctx.arc(x, y, particleSize * 3, 0, Math.PI * 2);
			ctx.fillStyle = gradient;
			ctx.fill();

			// Core
			ctx.beginPath();
			ctx.arc(x, y, particleSize, 0, Math.PI * 2);
			ctx.fillStyle = '#ffffff';
			ctx.fill();
		});

		// Draw nodes
		nodes.forEach(node => {
			// Node glow
			const glowGradient = ctx.createRadialGradient(
				node.x, node.y, node.radius * 0.5,
				node.x, node.y, node.radius * 1.5
			);
			glowGradient.addColorStop(0, node.color + '66');
			glowGradient.addColorStop(1, node.color + '00');

			ctx.beginPath();
			ctx.arc(node.x, node.y, node.radius * 1.5, 0, Math.PI * 2);
			ctx.fillStyle = glowGradient;
			ctx.fill();

			// Node circle
			ctx.beginPath();
			ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
			ctx.fillStyle = node.color;
			ctx.fill();

			// Node border
			ctx.strokeStyle = '#ffffff33';
			ctx.lineWidth = 2;
			ctx.stroke();

			// Node label
			if (showLabels) {
				ctx.font = '12px Inter, system-ui, sans-serif';
				ctx.fillStyle = '#e2e8f0'; // slate-200
				ctx.textAlign = 'center';
				ctx.textBaseline = 'top';
				ctx.fillText(node.id, node.x, node.y + node.radius + 8);
			}
		});
	}

	let lastTime = 0;

	function animate(currentTime: number) {
		const deltaTime = currentTime - lastTime;
		lastTime = currentTime;

		if (!isPaused) {
			// Spawn new particles based on messages
			if (messages.length > 0 && currentTime - lastMessageTime > messageInterval / animationSpeed) {
				const msg = messages[messageIndex % messages.length];
				if (msg.from !== '__system__') {
					spawnParticle(msg);
				}
				messageIndex++;
				lastMessageTime = currentTime;
			}

			updateParticles(deltaTime);
		}

		draw();

		animationId = requestAnimationFrame(animate);
	}

	function handleResize() {
		if (canvas) {
			const rect = canvas.parentElement?.getBoundingClientRect();
			if (rect) {
				width = rect.width;
				height = Math.max(400, rect.height);
				canvas.width = width;
				canvas.height = height;
				calculateNodePositions();
			}
		}
	}

	onMount(() => {
		if (!browser) return;

		ctx = canvas.getContext('2d')!;
		handleResize();
		calculateNodePositions();
		animationId = requestAnimationFrame(animate);

		window.addEventListener('resize', handleResize);
	});

	onDestroy(() => {
		if (!browser) return;

		if (animationId) {
			cancelAnimationFrame(animationId);
		}
		window.removeEventListener('resize', handleResize);
	});

	// Recalculate when agents change
	$effect(() => {
		if (agents.length > 0 && width > 0) {
			calculateNodePositions();
		}
	});
</script>

<div class="relative w-full h-full min-h-[400px] bg-slate-900 rounded-lg overflow-hidden">
	<canvas
		bind:this={canvas}
		class="w-full h-full"
		{width}
		{height}
	></canvas>

	<!-- Controls overlay -->
	<div class="absolute bottom-4 left-4 flex gap-4 bg-slate-800/80 backdrop-blur rounded-lg p-3 border border-slate-700">
		<label class="flex items-center gap-2 text-sm text-slate-300">
			<span>Speed:</span>
			<input
				type="range"
				min="0.25"
				max="3"
				step="0.25"
				bind:value={animationSpeed}
				class="w-20 accent-cyan-500"
			/>
			<span class="w-8 text-slate-400">{animationSpeed}x</span>
		</label>

		<label class="flex items-center gap-2 text-sm text-slate-300">
			<input
				type="checkbox"
				bind:checked={showLabels}
				class="accent-cyan-500"
			/>
			<span>Labels</span>
		</label>
	</div>

	<!-- Legend -->
	<div class="absolute top-4 right-4 bg-slate-800/80 backdrop-blur rounded-lg p-3 border border-slate-700">
		<h4 class="text-xs font-medium text-slate-400 mb-2">Agents</h4>
		<div class="flex flex-wrap gap-2 max-w-[200px]">
			{#each nodes as node}
				<div class="flex items-center gap-1.5">
					<div
						class="w-3 h-3 rounded-full"
						style="background-color: {node.color}"
					></div>
					<span class="text-xs text-slate-300">{node.id}</span>
				</div>
			{/each}
		</div>
	</div>

	<!-- Stats -->
	<div class="absolute top-4 left-4 bg-slate-800/80 backdrop-blur rounded-lg px-3 py-2 border border-slate-700">
		<div class="text-xs text-slate-400">
			{#if isPaused}
				<span class="text-cyan-400 font-medium">⏸ Paused</span> &middot;
			{/if}
			<span class="text-cyan-400 font-medium">{particles.length}</span> active &middot;
			<span class="text-slate-500">{messageIndex}</span> / <span class="text-slate-500">{messages.length}</span> messages
		</div>
	</div>

	<!-- Recent Messages Feed (only if showMessageFeed is true) -->
	{#if showMessageFeed}
		<div
			class="absolute bottom-4 right-4 w-96 bg-slate-800/90 backdrop-blur rounded-lg border border-slate-700 overflow-hidden transition-all {isPaused ? 'ring-2 ring-cyan-500' : ''}"
			on:mouseenter={() => isPaused = true}
			on:mouseleave={() => isPaused = false}
			role="region"
			aria-label="Message feed"
		>
			<div class="px-3 py-2 border-b border-slate-700 bg-slate-900/50 flex items-center justify-between">
				<h4 class="text-xs font-medium text-slate-400">Live Message Feed</h4>
				{#if isPaused}
					<span class="text-xs text-cyan-400 flex items-center gap-1">
						<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
							<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
						</svg>
						Paused
					</span>
				{/if}
			</div>
			<div class="max-h-64 overflow-y-auto">
				{#each recentMessages as msg (msg.id)}
					<button
						class="w-full text-left px-3 py-2 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer"
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
							<p class="text-xs text-slate-300 whitespace-pre-wrap break-words">{msg.body}</p>
						{:else}
							<p class="text-xs text-slate-300 line-clamp-2">{truncateBody(msg.body, 120)}</p>
						{/if}
					</button>
				{/each}
				{#if recentMessages.length === 0}
					<div class="px-3 py-4 text-xs text-slate-500 text-center">
						Waiting for messages...
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	canvas {
		display: block;
	}

	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	input[type="range"] {
		-webkit-appearance: none;
		appearance: none;
		height: 4px;
		border-radius: 2px;
		background: #334155;
	}

	input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #06b6d4;
		cursor: pointer;
	}

	input[type="checkbox"] {
		width: 16px;
		height: 16px;
		cursor: pointer;
	}
</style>
