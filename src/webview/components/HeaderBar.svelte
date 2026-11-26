<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { DashboardState } from '../../types';
  import { dashboardRefreshing } from '../lib/dashboardStore';
  import { i18n, toggleLocale } from '../lib/i18n';
  import { vscodeApi } from '../lib/vscodeApi';

  export let state: DashboardState;

  $: isRefreshing = $dashboardRefreshing || state.syncStatus === 'running';
  $: effectiveStatus = isRefreshing ? 'running' : state.syncStatus;

  let timeRemaining = 0;
  let progress = 0;
  let animationFrameId: number;
  let firedAutoRefresh = false;
  let lastSeenPollAt: number | undefined;
  let lastAutoRefreshAt = 0;

  function tick() {
    if (state.lastPollAt && state.config.pollIntervalMs && state.syncStatus === 'idle') {
      // Reset auto-refresh flag when a new poll result arrives
      if (lastSeenPollAt !== state.lastPollAt) {
        lastSeenPollAt = state.lastPollAt;
        firedAutoRefresh = false;
      }

      const now = Date.now();
      const nextPollAt = state.lastPollAt + state.config.pollIntervalMs;
      const remaining = Math.max(0, nextPollAt - now);
      timeRemaining = Math.ceil(remaining / 1000);
      progress = 1 - (remaining / state.config.pollIntervalMs);

      // Trigger auto-refresh when countdown reaches 0, respecting 30s minimum cooldown
      if (remaining === 0 && !firedAutoRefresh && now - lastAutoRefreshAt >= 30_000) {
        firedAutoRefresh = true;
        lastAutoRefreshAt = now;
        vscodeApi.postMessage({ type: 'dashboard/autoRefresh' });
      }
    } else {
      timeRemaining = 0;
      progress = 0;
      // Reset flag when sync is running so next idle cycle can fire again
      if (state.syncStatus === 'running') {
        firedAutoRefresh = false;
      }
    }
    animationFrameId = requestAnimationFrame(tick);
  }

  onMount(() => {
    animationFrameId = requestAnimationFrame(tick);
  });

  onDestroy(() => {
    cancelAnimationFrame(animationFrameId);
  });

  function handleRefresh() {
    vscodeApi.postMessage({ type: 'dashboard/refresh' });
  }
</script>

<header class="top-bar">
  <div class="top-bar-content">
    <div class="brand">
      <div class="logo-mark" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5" opacity="0.85" />
          <circle cx="8" cy="8" r="2" fill="currentColor" />
        </svg>
      </div>
      <h1 class="title"><span>Antigravity TokenScope</span> <span class="cn-title">{$i18n.dashboardSubtitle}</span></h1>
    </div>

    <div class="actions">
      {#if !isRefreshing && state.syncStatus === 'idle' && state.lastPollAt && state.config.pollIntervalMs}
        <div class="countdown-container" title="{$i18n.countdownTitle}: {timeRemaining}s">
          <svg viewBox="0 0 24 24" class="ring-svg">
            <circle class="ring-bg" cx="12" cy="12" r="10"></circle>
            <circle class="ring-fg" cx="12" cy="12" r="10" stroke-dasharray="62.83" stroke-dashoffset="{62.83 * (1 - Math.max(0, Math.min(1, progress)))}"></circle>
          </svg>
          <div class="countdown-glow"></div>
          <span class="time-text">{timeRemaining}</span>
        </div>
      {/if}

      <div class="status-pill {effectiveStatus}">
        <span class="status-indicator"></span>
        {isRefreshing ? $i18n.syncRunningLabel : (state.syncStatus === 'error' && state.syncMessage ? state.syncMessage : $i18n.syncIdleLabel)}
      </div>
      <button class="lang-btn" type="button" on:click={toggleLocale} title={$i18n.langSwitchTitle}>
        {$i18n.langSwitchLabel}
      </button>
      <button class="button" type="button" on:click={handleRefresh} disabled={isRefreshing}>
        <svg class="refresh-icon" class:spinning={isRefreshing} width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M13.451 5.609l-.579-.939-1.068.812-.076.094c.335.57.528 1.236.528 1.949 0 2.044-1.6 3.703-3.588 3.703-1.987 0-3.599-1.659-3.599-3.703C5.069 5.481 6.681 3.822 8.668 3.822c.32 0 .631.047.926.131l-.85.85h2.932V1.87l-.907.906A5.266 5.266 0 008.668 2.12c-2.898 0-5.244 2.421-5.244 5.405 0 2.985 2.346 5.405 5.244 5.405 2.898 0 5.244-2.42 5.244-5.405a5.44 5.44 0 00-.461-2.176v.26z"/>
        </svg>
        <span>{isRefreshing ? $i18n.refreshingNow : $i18n.refreshNow}</span>
      </button>
    </div>
  </div>
</header>

<style>
  .top-bar {
    background: var(--surface-glass, var(--bg-elevated));
    border-bottom: 1px solid var(--line);
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: blur(16px) saturate(140%);
  }
  .top-bar::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -1px;
    height: 1px;
    background: var(--edge-highlight, transparent);
    opacity: 0.45;
    pointer-events: none;
  }
  .top-bar-content {
    padding: 10px var(--spacing-xl);
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1600px;
    margin: 0 auto;
    width: 100%;
    gap: var(--spacing-md);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .logo-mark {
    width: 24px;
    height: 24px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-strong);
    background: color-mix(in srgb, var(--accent) 14%, var(--panel));
    border: 1px solid color-mix(in srgb, var(--accent) 32%, transparent);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
  }
  .title {
    font-size: 13px;
    font-weight: 600;
    margin: 0;
    letter-spacing: 0.02em;
    color: var(--text);
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .cn-title {
    font-size: 11px;
    font-weight: 500;
    color: var(--muted);
    letter-spacing: 0.04em;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .button,
  .lang-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 1px solid var(--line-strong);
    background: color-mix(in srgb, var(--bg-elevated) 70%, transparent);
    color: var(--text);
    border-radius: 999px;
    padding: 5px 12px;
    font-size: 12px;
    cursor: pointer;
    font-weight: 500;
    min-height: 28px;
    transition: border-color 180ms var(--ease-spring, ease), background 180ms, color 180ms, transform 180ms var(--ease-spring, ease);
  }
  .lang-btn {
    padding: 4px 10px;
    font-size: 11px;
    font-family: var(--code-font);
    color: var(--muted);
  }
  .button:hover:not(:disabled),
  .lang-btn:hover {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--accent-strong);
    transform: translateY(-1px);
  }
  .button:disabled {
    opacity: 0.65;
    cursor: wait;
  }
  .refresh-icon.spinning {
    animation: spin-icon 0.8s linear infinite;
  }
  @keyframes spin-icon {
    to { transform: rotate(360deg); }
  }
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--surface-line);
    color: var(--muted);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    background: var(--surface-subtle);
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .status-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--muted);
    flex-shrink: 0;
  }
  .status-pill.idle .status-indicator {
    background: var(--accent);
    box-shadow: 0 0 8px rgba(94, 234, 212, 0.55);
  }
  .status-pill.running .status-indicator {
    background: var(--warm);
    box-shadow: 0 0 8px rgba(251, 191, 36, 0.55);
    animation: pulse 1.4s infinite;
  }
  .status-pill.error .status-indicator {
    background: var(--danger);
    box-shadow: 0 0 8px rgba(248, 113, 113, 0.55);
  }
  .status-pill.error {
    color: var(--danger);
    border-color: color-mix(in srgb, var(--danger) 35%, transparent);
  }

  @keyframes pulse {
    0% { opacity: 0.5; }
    50% { opacity: 1; }
    100% { opacity: 0.5; }
  }

  /* Countdown Glow Styles */
  .countdown-container {
    position: relative;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ring-svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }
  .ring-bg {
    fill: none;
    stroke: var(--line-strong, rgba(255, 255, 255, 0.1));
    stroke-width: 2;
  }
  .ring-fg {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    stroke-linecap: round;
    /* Smooth out updates for circular progress */
    transition: stroke-dashoffset 0.1s linear;
  }
  .countdown-glow {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.15;
    filter: blur(4px);
    animation: glow-pulse 2s infinite alternate;
  }
  .time-text {
    position: relative;
    font-size: 10px;
    font-weight: 700;
    color: var(--accent-strong, #fff);
    font-variant-numeric: tabular-nums;
    z-index: 1;
  }
  @keyframes glow-pulse {
    0% { opacity: 0.1; transform: scale(0.9); }
    100% { opacity: 0.4; transform: scale(1.1); }
  }

  @media (max-width: 1200px) {
    .top-bar-content {
      padding: var(--spacing-sm) var(--spacing-md);
    }
  }

  @media (max-width: 760px) {
    .top-bar-content {
      flex-wrap: wrap;
      justify-content: center;
    }
    .brand {
      width: 100%;
      justify-content: center;
    }
    .actions {
      width: 100%;
      justify-content: center;
    }
  }
</style>
