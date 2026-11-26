<script lang="ts">
  import { i18n } from '../lib/i18n';
</script>

<article class="analytical-card">
  <div class="card-header">
    <h2 class="section-title">{$i18n.aboutTitle}</h2>
    <div class="card-meta">{$i18n.aboutSubtitle}</div>
  </div>

  <div class="card-body">
    <div class="info-card">
      <ul class="info-list">
        {#each $i18n.aboutItems as item}
          <li>
            <span class="highlight">{item.label}</span>：{item.text}
          </li>
        {/each}
      </ul>
    </div>
  </div>
</article>

<style>
  .analytical-card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: var(--shadow-elevated);
    flex: 1;
  }
  .card-header {
    padding: var(--spacing-sm) var(--spacing-md);
    border-bottom: 1px solid var(--line);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.01);
  }
  .section-title {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .card-meta {
    font-size: 11px;
    color: var(--muted);
  }
  .card-body {
    padding: var(--spacing-md);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .info-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--surface-line);
    border-radius: 8px;
    padding: var(--spacing-sm);
    flex: 1;
  }

  .info-list {
    margin: 0;
    padding: 0 0 0 var(--spacing-md);
    font-size: 11px;
    color: var(--muted);
    line-height: 1.5;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }
  .highlight {
    color: var(--text);
    font-weight: 500;
  }
</style>
