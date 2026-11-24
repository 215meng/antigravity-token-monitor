import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import App from './App.svelte';
import { dashboardState } from './lib/dashboardStore';
import { mockDashboardState } from './test/fixtures/dashboardState.fixture';

describe('App', () => {
  beforeEach(() => {
    dashboardState.set(null);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders loading state initially', () => {
    const { getByText } = render(App);
    expect(getByText('正在等待监控面板数据...')).toBeTruthy();
  });

  it('renders dashboard shell with key sections when state is provided', () => {
    dashboardState.set(mockDashboardState);
    const { getByRole, getAllByText, getByText } = render(App);
    
    expect(getAllByText('Antigravity TokenScope').length).toBeGreaterThan(0);
    
    expect(getByRole('region', { name: /overview hero/i })).toBeTruthy();
    expect(getByRole('region', { name: /analysis canvas/i })).toBeTruthy();
    expect(getByRole('complementary', { name: /operations rail/i })).toBeTruthy();
    expect(getByRole('region', { name: /session deck/i })).toBeTruthy();
    expect(getByText('$0.0041')).toBeTruthy();
    expect(getByText(/未匹配 LiteLLM 价格表/i)).toBeTruthy();
  });
});
