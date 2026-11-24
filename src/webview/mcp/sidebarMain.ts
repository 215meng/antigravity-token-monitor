import { mount } from 'svelte';
import SidebarApp from '../sidebar/SidebarApp.svelte';
import { initMcpAppRuntime } from './createMcpAppRuntime';

const appContainer = document.getElementById('sidebar-app');

if (!appContainer) {
  throw new Error('Sidebar app container not found.');
}

mount(SidebarApp, {
  target: appContainer
});

void initMcpAppRuntime('sidebar');
