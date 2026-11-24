import { mount } from 'svelte';
import App from '../App.svelte';
import { initMcpAppRuntime } from './createMcpAppRuntime';

const appContainer = document.getElementById('app');

if (!appContainer) {
  throw new Error('App container not found.');
}

mount(App, {
  target: appContainer
});

void initMcpAppRuntime('dashboard');
