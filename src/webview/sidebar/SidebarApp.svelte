<script lang="ts">
  import { dashboardError, dashboardRefreshing, dashboardState } from '../lib/dashboardStore';
  import { deriveDashboardInsights } from '../lib/deriveDashboardInsights';
  import { i18n, toggleLocale } from '../lib/i18n';
  import { sidebarApi } from './sidebarApi';
  import SidebarKpi from './components/SidebarKpi.svelte';
  import SidebarTokenMix from './components/SidebarTokenMix.svelte';
  import SidebarModelUsage from './components/SidebarModelUsage.svelte';
  import SidebarHeatmap from './components/SidebarHeatmap.svelte';
  import SidebarSessionList from './components/SidebarSessionList.svelte';
  import SidebarSyncStatus from './components/SidebarSyncStatus.svelte';

  $: insights = $dashboardState ? deriveDashboardInsights($dashboardState) : null;
  $: isRefreshing = $dashboardRefreshing || insights?.syncStatus === 'running';

  function handleRefresh() {
    sidebarApi.postMessage({ type: 'sidebar/refresh' });
  }

  function handleOpenDashboard() {
    sidebarApi.postMessage({ type: 'sidebar/openDashboard' });
  }

  function handleOpenSession(sessionId: string) {
    sidebarApi.postMessage({ type: 'sidebar/openSession', sessionId });
  }
</script>

{#if insights}
  <div class="sidebar-shell">
    <header class="sidebar-header">
      <h1 class="sidebar-title"><span>{$i18n.sidebarTitle}</span></h1>
      <div class="sidebar-actions">
        <button class="lang-btn" type="button" on:click={toggleLocale} title={$i18n.langSwitchTitle}>
          {$i18n.langSwitchLabel}
        </button>
        <button class="icon-btn" type="button" on:click={handleRefresh} disabled={isRefreshing} title={$i18n.sidebarRefreshTitle}>
          <svg class:spinning={isRefreshing} width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.451 5.609l-.579-.939-1.068.812-.076.094c.335.57.528 1.236.528 1.949 0 2.044-1.6 3.703-3.588 3.703-1.987 0-3.599-1.659-3.599-3.703C5.069 5.481 6.681 3.822 8.668 3.822c.32 0 .631.047.926.131l-.85.85h2.932V1.87l-.907.906A5.266 5.266 0 008.668 2.12c-2.898 0-5.244 2.421-5.244 5.405 0 2.985 2.346 5.405 5.244 5.405 2.898 0 5.244-2.42 5.244-5.405a5.44 5.44 0 00-.461-2.176v.26z"/></svg>
        </button>
        <button class="icon-btn" type="button" on:click={handleOpenDashboard} title={$i18n.sidebarOpenDashboardTitle}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 1H6v1H2v12h12v-4h1v4.5l-.5.5h-13l-.5-.5v-13l.5-.5z"/><path d="M15 1.5V8h-1V2.707L7.243 9.465l-.707-.708L13.293 2H8V1h6.5l.5.5z"/></svg>
        </button>
      </div>
    </header>

    <main class="sidebar-content">
      {#if $dashboardError}
        <div class="error-banner" role="alert">
          <span>{$dashboardError}</span>
          <button class="retry-btn" on:click={() => sidebarApi.postMessage({ type: 'sidebar/ready' })}>{$i18n.retry}</button>
        </div>
      {/if}

      {#if !insights.hasSessions && (insights.syncStatus === 'running' || insights.exportStatus.status === 'running')}
        <div class="sync-banner" role="status">
          {$i18n.initialScanBannerShort}
        </div>
      {/if}

      <SidebarKpi
        summary={insights.summary}
        pricing={insights.pricing}
        monthlyUsage={insights.monthlyUsage}
        todayUsage={insights.todayUsage}
      />
      <SidebarTokenMix breakdown={insights.todayUsage} dateLabel={insights.todayUsage.label} />
      <SidebarModelUsage models={insights.analytics.modelUsage} />
      <SidebarHeatmap heatmap={insights.analytics.activityHeatmap} />
      <SidebarSessionList
        sessions={insights.sortedSessions}
        onOpenSession={handleOpenSession}
      />
      <SidebarSyncStatus state={insights} />
    </main>
  </div>
{:else if $dashboardError}
  <div class="loading error-state">
    <span class="error-text">{$dashboardError}</span>
    <button class="retry-btn" on:click={() => sidebarApi.postMessage({ type: 'sidebar/ready' })}>{$i18n.retryLoad}</button>
  </div>
{:else}
  <div class="loading">
    <div class="loading-spinner"></div>
    <span>{$i18n.loadingSidebar}</span>
  </div>
{/if}

<style>
  .sidebar-shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background:
      radial-gradient(ellipse 90% 35% at 50% 0%, rgba(94, 234, 212, 0.055), transparent 70%);
    animation: fade-in 220ms var(--ease-spring, ease);
  }
  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px var(--spacing-md);
    border-bottom: 1px solid var(--line);
    background: var(--surface-glass, var(--bg));
    backdrop-filter: blur(14px) saturate(135%);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .sidebar-title {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .sidebar-actions {
    display: flex;
    gap: 4px;
  }
  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--muted);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 14px;
    transition: background 160ms, color 160ms, border-color 160ms;
  }
  .icon-btn:hover:not(:disabled) {
    background: var(--surface-subtle, rgba(255, 255, 255, 0.08));
    border-color: var(--line);
    color: var(--accent-strong, var(--text));
  }
  .icon-btn:disabled {
    opacity: 0.6;
    cursor: wait;
  }
  .icon-btn svg.spinning {
    animation: spin 0.8s linear infinite;
  }
  .lang-btn {
    height: 22px;
    padding: 0 7px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
    background: var(--surface-subtle);
    color: var(--muted);
    font-size: 10px;
    font-family: var(--code-font);
    cursor: pointer;
    transition: color 140ms, border-color 140ms;
  }
  .lang-btn:hover {
    color: var(--accent-strong, var(--text));
    border-color: var(--accent);
  }
  .sidebar-content {
    padding: var(--spacing-md);
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
  }
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    height: 200px;
    padding: 0 var(--spacing-md);
    text-align: center;
    color: var(--muted);
    font-size: 12px;
  }
  .error-text {
    color: var(--danger);
    word-break: break-word;
  }
  .retry-btn {
    padding: 4px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.06);
    color: var(--text);
    cursor: pointer;
    font-size: 12px;
  }
  .sync-banner {
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
    background: rgba(136, 216, 176, 0.08);
    color: var(--accent);
    font-size: 11px;
    line-height: 1.4;
  }
  .error-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--danger);
    background: var(--bg-elevated);
    color: var(--danger);
    font-size: 11px;
    line-height: 1.4;
  }
  .loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--line);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
