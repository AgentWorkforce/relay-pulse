// Importing the component with customElement option auto-registers <animated-flow>
import './components/AnimatedFlow.svelte';

// Re-export utilities for consumers
export { parseMessages, getAgentColors, type Message, type MessageData, type RawEntry } from './data/parser.js';
