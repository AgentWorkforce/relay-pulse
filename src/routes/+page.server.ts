import type { PageServerLoad } from './$types';
import { parseMessages, getAgentColors } from '$lib/data/parser';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export const load: PageServerLoad = async () => {
	const messagesFile = process.env.MESSAGES_FILE;

	let content: string;
	let source: string;

	if (messagesFile) {
		const resolvedPath = resolve(messagesFile);

		if (!existsSync(resolvedPath)) {
			throw new Error(`Messages file not found: ${resolvedPath}`);
		}

		content = readFileSync(resolvedPath, 'utf-8');
		source = resolvedPath;
		console.log(`⚡ Relay Pulse loaded ${content.split('\n').length} lines from: ${resolvedPath}`);
	} else {
		const staticPath = resolve('static/messages.jsonl');

		if (!existsSync(staticPath)) {
			throw new Error('No messages file found. Use MESSAGES_FILE env var or place file at static/messages.jsonl');
		}

		content = readFileSync(staticPath, 'utf-8');
		source = 'static/messages.jsonl';
		console.log('⚡ Relay Pulse loaded from: static/messages.jsonl');
	}

	const messages = parseMessages(content);
	const agentColors = getAgentColors(messages);

	return {
		messages,
		agentColors: Object.fromEntries(agentColors),
		messageCount: messages.length,
		source
	};
};
