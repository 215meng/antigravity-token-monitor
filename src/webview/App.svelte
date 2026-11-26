<script lang="ts">
  import { dashboardError, dashboardState } from './lib/dashboardStore';
  import { deriveDashboardInsights } from './lib/deriveDashboardInsights';
  import { i18n } from './lib/i18n';
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
          <button class="retry-btn" on:click={() => vscodeApi.postMessage({ type: 'dashboard/ready' })}>{$i18n.retry}</button>
        </div>
      {/if}

      {#if !insights.hasSessions && (insights.syncStatus === 'running' || insights.exportStatus.status === 'running')}
        <div class="sync-banner" role="status">
          {$i18n.initialScanBanner}
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
    <button class="retry-btn" on:click={() => vscodeApi.postMessage({ type: 'dashboard/ready' })}>{$i18n.retryLoad}</button>
  </div>
{:else}
  <div class="loading">
    <div class="skeleton-shell">
      <div class="skeleton-pulse-dot"></div>
      <span>{$i18n.waitingDashboard}</span>
    </div>
  </div>
{/if}

<style>
  .shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background:
      radial-gradient(ellipse 65% 40% at 15% 0%, rgba(94, 234, 212, 0.055), transparent 65%),
      radial-gradient(ellipse 50% 35% at 88% 4%, rgba(96, 165, 250, 0.045), transparent 65%);
    animation: fade-in 260ms var(--ease-spring, ease);
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
    grid-template-columns: minmax(0, 1fr) 360px;
    gap: var(--spacing-lg);
    align-items: start;
  }
  .analysis-canvas {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }
  .bottom-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: var(--spacing-md);
  }
  .operations-rail {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    position: sticky;
    top: 64px;
  }
  .session-deck {
    width: 100%;
    margin-top: var(--spacing-xs);
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
    font-size: 13px;
    letter-spacing: 0.02em;
  }
  .skeleton-shell {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    border-radius: 999px;
    background: var(--surface-glass, var(--bg-elevated));
    border: 1px solid var(--line);
    box-shadow: var(--shadow-elevated);
  }
  .skeleton-pulse-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 12px var(--accent);
    animation: pulse-ring 1.6s ease-in-out infinite;
  }
  @keyframes pulse-ring {
    0%, 100% { transform: scale(0.9); opacity: 0.6; }
    50% { transform: scale(1.2); opacity: 1; }
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
    transition: border-color 180ms var(--ease-spring, ease), transform 180ms var(--ease-spring, ease);
  }
  .retry-btn:hover {
    border-color: var(--line-hover, var(--accent));
    transform: translateY(-1px);
  }
  .sync-banner {
    padding: 10px 16px;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line));
    background: color-mix(in srgb, var(--accent) 7%, var(--panel));
    color: var(--accent-strong);
    font-size: 13px;
    backdrop-filter: blur(8px);
  }
  .error-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px;
    border-radius: 12px;
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
      grid-template-columns: 1fr;
    }
  }
</style>
