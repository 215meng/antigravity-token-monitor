import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import App from './App.svelte';
import { dashboardState } from './lib/dashboardStore';
import { setLocale } from './lib/i18n';
import { mockDashboardState } from './test/fixtures/dashboardState.fixture';

describe('App', () => {
  beforeEach(() => {
    setLocale('zh');
    dashboardState.set(null);
  });

  afterEach(() => {
    setLocale('zh');
    cleanup();
  });

  it('renders loading state initially', () => {
    const { getByText } = render(App);
    expect(getByText('正在等待监控面板数据...')).toBeTruthy();
  });

  it('renders dashboard shell with key sections and switches between Chinese and English', async () => {
    dashboardState.set(mockDashboardState);
    const { getByRole, getAllByText, getByText } = render(App);
    
    expect(getAllByText('Antigravity TokenScope').length).toBeGreaterThan(0);
    
    expect(getByRole('region', { name: /overview hero/i })).toBeTruthy();
    expect(getByRole('region', { name: /analysis canvas/i })).toBeTruthy();
    expect(getByRole('complementary', { name: /operations rail/i })).toBeTruthy();
    expect(getByRole('region', { name: /session deck/i })).toBeTruthy();
    expect(getByText('$0.0041')).toBeTruthy();
    expect(getByText(/未匹配 LiteLLM 价格表/i)).toBeTruthy();
    expect(getByText('Token 总消耗量')).toBeTruthy();

    // Switch to English
    await fireEvent.click(getByText('EN'));
    expect(getAllByText('Total Tokens').length).toBeGreaterThanOrEqual(2);
    expect(getByText('Daily Activity Heatmap')).toBeTruthy();
    expect(getByText(/Unpriced in LiteLLM/i)).toBeTruthy();

    // Switch back to Chinese
    await fireEvent.click(getByText('中文'));
    expect(getByText('Token 总消耗量')).toBeTruthy();
    expect(getByText('每日活跃热力图')).toBeTruthy();
  });
});
