import { writable } from 'svelte/store';
import type { DashboardState } from '../../types';

export const dashboardState = writable<DashboardState | null>(null);
export const dashboardError = writable<string | null>(null);
export const dashboardRefreshing = writable<boolean>(false);
