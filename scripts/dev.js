#!/usr/bin/env node

import { spawn } from 'child_process';
import { resolve } from 'path';

// Parse CLI arguments
const args = process.argv.slice(2);
let messagesFile = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--messages=')) {
    // Use substring to get everything after '--messages='
    messagesFile = arg.substring('--messages='.length);
  } else if (arg === '--messages' || arg === '-m') {
    if (args[i + 1] && !args[i + 1].startsWith('-')) {
      messagesFile = args[i + 1];
      i++; // Skip next arg since we consumed it
    }
  }
}

// Set up environment
const env = { ...process.env };
if (messagesFile) {
  env.MESSAGES_FILE = resolve(messagesFile);
  console.log(`⚡ Relay Pulse: Loading messages from ${env.MESSAGES_FILE}`);
}

// Run vite dev
const vite = spawn('npx', ['vite', 'dev'], {
  stdio: 'inherit',
  env,
  shell: true
});

vite.on('close', (code) => {
  process.exit(code);
});
