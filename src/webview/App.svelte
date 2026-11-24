<script lang="ts">
  import { dashboardError, dashboardState } from './lib/dashboardStore';
  import { deriveDashboardInsights } from './lib/deriveDashboardInsights';
  import { vscodeApi } from './lib/vscodeApi';
  import HeaderBar from './components/HeaderBar.svelte';
  import KpiStrip from './components/KpiStrip.svelte';
  import SessionLeaderboard from './components/SessionLeaderboard.svelte';
  import ActivityHeatmap from './components/ActivityHeatmap.svelte';
  import ModelUsage from './components/ModelUsage.svelte';
  import SourceModeBreakdown from './components/SourceModeBreakdown.svelte';
  import TokenBreakdownPanel from './components/TokenBreakdownPanel.svelte';
  import SystemStatus from './components/SystemStatus.svelte';
  import Configuration from './components/Configuration.svelte';
  import AboutMetrics from './components/AboutMetrics.svelte';

  $: insights = $dashboardState ? deriveDashboardInsights($dashboardState) : null;
</script>

{#if insights}
  <div class="shell">
    <HeaderBar state={insights} />

    <main class="main-content">
      {#if $dashboardError}
        <div class="error-banner" role="alert">
          <span>{$dashboardError}</span>
          <button class="retry-btn" on:click={() => vscodeApi.postMessage({ type: 'dashboard/ready' })}>重试</button>
        </div>
      {/if}

      {#if !insights.hasSessions && (insights.syncStatus === 'running' || insights.exportStatus.status === 'running')}
        <div class="sync-banner" role="status">
          正在后台首次扫描本机历史会话，完成后将自动刷新图表与本月累计数据...
        </div>
      {/if}

      <section aria-label="Overview Hero" class="hero-region">
        <KpiStrip
          summary={insights.summary}
          pricing={insights.pricing}
          monthlyUsage={insights.monthlyUsage}
          todayUsage={insights.todayUsage}
        />
      </section>

      <div class="dashboard-grid">
        <section aria-label="Analysis Canvas" class="analysis-canvas">
          <ActivityHeatmap heatmap={insights.analytics.activityHeatmap} />
          <ModelUsage models={insights.analytics.modelUsage} />
        </section>

        <aside aria-label="Operations Rail" class="operations-rail">
          <TokenBreakdownPanel breakdown={insights.todayUsage} dateLabel={insights.todayUsage.label} />
        </aside>
      </div>

      <section aria-label="System Status & Coverage" class="bottom-cards">
        <SourceModeBreakdown coverage={insights.analytics.rpcCoverage} exportedInLastRun={insights.exportStatus.lastExportedCount} />
        <SystemStatus state={insights} />
        <Configuration state={insights} />
        <AboutMetrics />
      </section>

      <section aria-label="Session Deck" class="session-deck">
        <SessionLeaderboard sessions={insights.sortedSessions} />
      </section>
    </main>
  </div>
{:else if $dashboardError}
  <div class="loading error-state">
    <p class="error-text">{$dashboardError}</p>
    <button class="retry-btn" on:click={() => vscodeApi.postMessage({ type: 'dashboard/ready' })}>重试加载</button>
  </div>
{:else}
  <div class="loading">正在等待监控面板数据...</div>
{/if}

<style>
  .shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: transparent;
    animation: fade-in 220ms ease;
  }
  .main-content {
    padding: var(--spacing-lg) var(--spacing-xl) var(--spacing-xl);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    max-width: 1600px;
    margin: 0 auto;
    width: 100%;
  }
  .hero-region {
    width: 100%;
  }
  .dashboard-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: var(--spacing-lg);
    align-items: start;
  }
  .analysis-canvas {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }
  .bottom-cards {
    display: flex;
    gap: var(--spacing-md);
  }
  .operations-rail {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    position: sticky;
    top: var(--spacing-lg);
  }
  .session-deck {
    width: 100%;
    margin-top: var(--spacing-md);
  }
  .loading {
    padding: 42px 20px;
    text-align: center;
    color: var(--muted);
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
    justify-content: center;
    height: 100vh;
    font-size: 14px;
    letter-spacing: 0.02em;
  }
  .error-text {
    margin: 0;
    color: var(--danger);
    max-width: 520px;
    word-break: break-word;
  }
  .retry-btn {
    padding: 6px 14px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: var(--bg-elevated);
    color: var(--text);
    cursor: pointer;
  }
  .sync-banner {
    padding: 10px 16px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--bg-elevated);
    color: var(--accent);
    font-size: 13px;
  }
  .error-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px;
    border-radius: 10px;
    border: 1px solid var(--danger);
    background: var(--bg-elevated);
    color: var(--danger);
    font-size: 13px;
  }
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @media (max-width: 1200px) {
    .dashboard-grid {
      grid-template-columns: 1fr;
    }
    .main-content {
      padding: var(--spacing-md) var(--spacing-md) var(--spacing-xl);
    }
    .operations-rail {
      position: static;
    }
  }
  @media (max-width: 800px) {
    .bottom-cards {
      flex-direction: column;
    }
  }
</style>
