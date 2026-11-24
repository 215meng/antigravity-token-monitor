import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import SidebarApp from './SidebarApp.svelte';
import { dashboardState } from '../lib/dashboardStore';
import { mockDashboardState } from '../test/fixtures/dashboardState.fixture';

describe('SidebarApp', () => {
  beforeEach(() => {
    dashboardState.set(null);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders loading state initially', () => {
    const { getByText } = render(SidebarApp);
    expect(getByText('正在加载 Token 数据...')).toBeTruthy();
  });

  it('renders sidebar shell with all sections when state is provided', () => {
    dashboardState.set(mockDashboardState);
    const { getByText, getAllByText, container } = render(SidebarApp);

    // Header
    expect(getByText('Token 用量简报')).toBeTruthy();

    // KPI section
    expect(getByText(/本月累计/)).toBeTruthy();
    expect(getAllByText(/今日/).length).toBe(2);
    expect(getByText('Token 总消耗量')).toBeTruthy();
    expect(getByText('活跃会话')).toBeTruthy();
    expect(getByText('消息数')).toBeTruthy();
    expect(getByText('预估成本')).toBeTruthy();

    // Token Breakdown section
    expect(getByText('Token 构成细分')).toBeTruthy();
    expect(getByText('输入')).toBeTruthy();
    expect(getByText('输出')).toBeTruthy();

    // Model Usage section
    expect(getByText('模型使用分布')).toBeTruthy();
    expect(getByText('mock-model')).toBeTruthy();

    // Heatmap section
    expect(getByText('最近 30 天')).toBeTruthy();

    // Session List section
    expect(getByText('最近活跃会话')).toBeTruthy();
    expect(getByText('Session 1')).toBeTruthy();

    // Sync Status section
    expect(getByText('运行状态')).toBeTruthy();

    // Verify sidebar-specific structure
    const shell = container.querySelector('.sidebar-shell');
    expect(shell).toBeTruthy();
    const header = container.querySelector('.sidebar-header');
    expect(header).toBeTruthy();
  });

  it('shows active session count in session header', () => {
    dashboardState.set(mockDashboardState);
    const { getByText } = render(SidebarApp);
    expect(getByText('1 active')).toBeTruthy();
  });

  it('displays cost when pricing is available', () => {
    dashboardState.set(mockDashboardState);
    const { getByText } = render(SidebarApp);
    // mockDashboardState has pricing.totalCostUsd = 0.0041
    expect(getByText('$0.0041')).toBeTruthy();
  });

  it('shows estimated session indicator', () => {
    dashboardState.set(mockDashboardState);
    const { getByText } = render(SidebarApp);
    // mockDashboardState has 1 estimated session
    expect(getByText(/1 个估算/)).toBeTruthy();
  });

  it('shows archived sessions info', () => {
    dashboardState.set(mockDashboardState);
    const { getByText } = render(SidebarApp);
    expect(getByText(/1 个归档/)).toBeTruthy();
  });
});
