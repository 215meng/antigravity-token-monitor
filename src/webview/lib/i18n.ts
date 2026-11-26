import { derived, writable } from 'svelte/store';

export type Locale = 'zh' | 'en';

const STORAGE_KEY = 'tokenscope-locale';

function readInitialLocale(): Locale {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'zh') {
        return saved;
      }
    }
  } catch {
  }
  return 'zh';
}

export const locale = writable<Locale>(readInitialLocale());

export function setLocale(next: Locale): void {
  locale.set(next);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  } catch {
  }
}

export function toggleLocale(): void {
  locale.update((current) => {
    const next: Locale = current === 'zh' ? 'en' : 'zh';
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
    } catch {
    }
    return next;
  });
}

export type TranslationDict = {
  // Common / Loading
  waitingDashboard: string;
  loadingSidebar: string;
  retry: string;
  retryLoad: string;
  initialScanBanner: string;
  initialScanBannerShort: string;
  langSwitchLabel: string;
  langSwitchTitle: string;

  // Header
  dashboardSubtitle: string;
  countdownTitle: string;
  syncIdleLabel: string;
  syncRunningLabel: string;
  refreshNow: string;
  refreshingNow: string;
  sidebarTitle: string;
  sidebarRefreshTitle: string;
  sidebarOpenDashboardTitle: string;

  // Hero & KPI
  todayFocus: string;
  todayLabel: string;
  monthlyCumulative: string;
  totalTokens: string;
  totalSessions: string;
  totalMessages: string;
  totalCost: string;
  activeLabel: string;
  archivedLabel: string;
  activeSessionsShort: string;
  messagesShort: string;
  estCostShort: string;
  activeDaysSuffix: string;
  dailyAvgPrefix: string;
  costUnavailable: string;
  noPricingMatch: string;
  sessionMetaSummary: (total: number, archived: number, estimated: number) => string;

  // Token Breakdown
  tokenBreakdownTitle: string;
  todayPrefix: string;
  classifiedTotal: string;
  classifiedPct: string;
  cacheHitLabel: string;
  inputLabel: string;
  outputLabel: string;
  cacheLabel: string;
  reasoningLabel: string;
  inputShort: string;
  outputShort: string;
  cacheShort: string;
  reasoningShort: string;
  inputDesc: string;
  outputDesc: string;
  cacheReadDesc: string;
  cacheWriteDesc: string;
  reasoningDesc: string;

  // Heatmap
  heatmapTitle: string;
  heatmapSubtitle: string;
  heatmapLess: string;
  heatmapMore: string;
  dayLabels: string[];
  last30Days: string;
  tokenThroughput: string;
  estimatedCostLabel: string;
  messagesCountLabel: string;
  sessionsUnit: (n: number) => string;

  // Model Usage
  modelUsageTitle: string;
  modelUsageSubtitle: string;
  sessionsCountSuffix: string;
  emptyModels: string;
  moreModels: (n: number) => string;

  // Session Leaderboard & Sidebar Sessions
  sessionDeckTitle: string;
  sessionDeckSubtitle: string;
  colSession: string;
  colMode: string;
  colMessages: string;
  colTotal: string;
  colDelta: string;
  colPulse: string;
  statusActive: string;
  statusArchived: string;
  modeReported: string;
  modeEstimated: string;
  lastActivePrefix: string;
  emptySessions: string;
  recentActiveSessions: string;
  activeCountSuffix: string;
  archivedCountSuffix: string;
  expandMoreSessions: (n: number) => string;
  collapseSessions: string;
  emptySidebarSessions: string;

  // Coverage / Status / Config / About
  coverageTitle: string;
  coverageSubtitle: string;
  trackingScope: string;
  trackedSessions: string;
  changedSessions: string;
  exportHealth: string;
  exportedCoverage: string;
  lastExportWrite: string;
  archivedStable: string;

  systemStatusTitle: string;
  systemStatusSubtitle: string;
  exportPipeline: string;
  lastExportTime: string;
  neverExported: string;

  configTitle: string;
  configSubtitle: string;
  sessionRootLabel: string;
  rpcExportLabel: string;
  stepsExportLabel: string;
  enabled: string;
  disabled: string;
  stepsMetaOnlyTitle: string;
  stepsMetaOnlyCopy: string;

  aboutTitle: string;
  aboutSubtitle: string;
  aboutItems: Array<{ label: string; text: string }>;

  // Sidebar Sync
  runtimeStatusTitle: string;
  dataSyncLabel: string;
  backgroundExportLabel: string;
  syncingText: string;
  exportingText: string;
  notStarted: string;
  idleText: string;
};

const ZH_DICT: TranslationDict = {
  waitingDashboard: '正在等待监控面板数据...',
  loadingSidebar: '正在加载 Token 数据...',
  retry: '重试',
  retryLoad: '重试加载',
  initialScanBanner: '正在扫描历史会话，完成后自动更新图表与统计。',
  initialScanBannerShort: '正在扫描历史会话...',
  langSwitchLabel: 'EN',
  langSwitchTitle: 'Switch to English',

  dashboardSubtitle: '可观测性看板',
  countdownTitle: '自动刷新倒计时',
  syncIdleLabel: '增量索引就绪',
  syncRunningLabel: '正在同步...',
  refreshNow: '立即刷新',
  refreshingNow: '刷新中...',
  sidebarTitle: 'Token 用量简报',
  sidebarRefreshTitle: '立即刷新',
  sidebarOpenDashboardTitle: '打开完整监控大屏',

  todayFocus: '今日用量',
  todayLabel: 'Today',
  monthlyCumulative: '本月累计',
  totalTokens: 'Token 总消耗量',
  totalSessions: '监控会话总数',
  totalMessages: '交互消息总数',
  totalCost: '预估总成本',
  activeLabel: '活跃',
  archivedLabel: '归档',
  activeSessionsShort: '活跃会话',
  messagesShort: '消息数',
  estCostShort: '预估成本',
  activeDaysSuffix: '天活跃',
  dailyAvgPrefix: '日均',
  costUnavailable: '不可用',
  noPricingMatch: '未匹配 LiteLLM 价格表',
  sessionMetaSummary: (total, archived, estimated) =>
    `共 ${total} 个会话 (${archived} 个归档)${estimated > 0 ? ` • ${estimated} 个估算` : ''}`,

  tokenBreakdownTitle: 'Token 构成细分',
  todayPrefix: '今日',
  classifiedTotal: '已分类总计',
  classifiedPct: '已归类',
  cacheHitLabel: '缓存命中',
  inputLabel: '输入 (Input)',
  outputLabel: '输出 (Output)',
  cacheLabel: '缓存 (Cache)',
  reasoningLabel: '深度思考 (Reasoning)',
  inputShort: '输入',
  outputShort: '输出',
  cacheShort: '缓存',
  reasoningShort: '深度思考',
  inputDesc: '净输入 (Input)',
  outputDesc: '净输出 (Output)',
  cacheReadDesc: '缓存命中 (Cache Read)',
  cacheWriteDesc: '缓存写入 (Cache Write)',
  reasoningDesc: '深度思考 (Reasoning)',

  heatmapTitle: '每日活跃热力图',
  heatmapSubtitle: '按调用真实时间戳归档',
  heatmapLess: '少',
  heatmapMore: '多',
  dayLabels: ['日', '一', '二', '三', '四', '五', '六'],
  last30Days: '最近 30 天',
  tokenThroughput: 'Token 用量',
  estimatedCostLabel: '预估费用',
  messagesCountLabel: '消息数',
  sessionsUnit: (n) => `${n} 个会话`,

  modelUsageTitle: '模型使用分布',
  modelUsageSubtitle: '按消耗降序',
  sessionsCountSuffix: '个会话',
  emptyModels: '暂无模型数据',
  moreModels: (n) => `+ 其余 ${n} 个模型`,

  sessionDeckTitle: '会话明细',
  sessionDeckSubtitle: '按最近活跃排序',
  colSession: '会话',
  colMode: '状态与来源',
  colMessages: '消息数',
  colTotal: 'Token 总量',
  colDelta: '增量',
  colPulse: '趋势',
  statusActive: '活跃',
  statusArchived: '已归档',
  modeReported: 'Reported',
  modeEstimated: 'Estimated',
  lastActivePrefix: '活跃于',
  emptySessions: '暂无会话数据',
  recentActiveSessions: '最近活跃会话',
  activeCountSuffix: 'active',
  archivedCountSuffix: 'archived',
  expandMoreSessions: (n) => `展开其余 ${n} 个会话`,
  collapseSessions: '收起',
  emptySidebarSessions: '暂无活跃会话',

  coverageTitle: '采集覆盖率',
  coverageSubtitle: 'RPC / 本地数据源',
  trackingScope: '会话范围',
  trackedSessions: '已跟踪',
  changedSessions: '近期变更',
  exportHealth: '导出覆盖',
  exportedCoverage: '已导出',
  lastExportWrite: '上次导出',
  archivedStable: '已归档稳定',

  systemStatusTitle: '运行状态',
  systemStatusSubtitle: '采集流水线',
  exportPipeline: 'RPC 导出管道',
  lastExportTime: '最近导出',
  neverExported: '暂无记录',

  configTitle: '运行时配置',
  configSubtitle: '当前参数',
  sessionRootLabel: '会话目录',
  rpcExportLabel: 'RPC 自动导出',
  stepsExportLabel: '步骤明细导出',
  enabled: '已启用',
  disabled: '未启用',
  stepsMetaOnlyTitle: 'Steps：仅元数据',
  stepsMetaOnlyCopy: '仅导出时间、模型与角色元数据，完整正文按需关闭。',

  aboutTitle: '核算口径',
  aboutSubtitle: '计量规范',
  aboutItems: [
    { label: 'Reported', text: '源自本地 RPC 响应载荷的精确 Token 计量。' },
    { label: 'Estimated', text: '无 RPC 载荷时的启发式字符保底估算。' },
    { label: '跨会话仲裁', text: '按 responseId 归属唯一父会话，剔除 Subagent 克隆重复并融合撤回分支。' },
    { label: '真实按日归属', text: '严格依每次调用真实时间戳入账对应自然日与当日模型价格。' }
  ],

  runtimeStatusTitle: '运行状态',
  dataSyncLabel: '数据同步',
  backgroundExportLabel: '后台导出',
  syncingText: '同步中...',
  exportingText: '导出中...',
  notStarted: '未同步',
  idleText: '空闲'
};

const EN_DICT: TranslationDict = {
  waitingDashboard: 'Waiting for telemetry...',
  loadingSidebar: 'Loading token telemetry...',
  retry: 'Retry',
  retryLoad: 'Retry Load',
  initialScanBanner: 'Scanning local session history. Charts will populate automatically.',
  initialScanBannerShort: 'Scanning local sessions...',
  langSwitchLabel: '中文',
  langSwitchTitle: '切换至简体中文',

  dashboardSubtitle: 'Observability',
  countdownTitle: 'Auto-refresh countdown',
  syncIdleLabel: 'Incremental Ready',
  syncRunningLabel: 'Syncing...',
  refreshNow: 'Refresh',
  refreshingNow: 'Refreshing...',
  sidebarTitle: 'TokenScope Brief',
  sidebarRefreshTitle: 'Refresh now',
  sidebarOpenDashboardTitle: 'Open full dashboard',

  todayFocus: 'Today',
  todayLabel: 'Today',
  monthlyCumulative: 'Monthly',
  totalTokens: 'Total Tokens',
  totalSessions: 'Sessions',
  totalMessages: 'Messages',
  totalCost: 'Est. Total Cost',
  activeLabel: 'Active',
  archivedLabel: 'Archived',
  activeSessionsShort: 'Active',
  messagesShort: 'Messages',
  estCostShort: 'Est. Cost',
  activeDaysSuffix: 'd active',
  dailyAvgPrefix: 'Avg',
  costUnavailable: 'N/A',
  noPricingMatch: 'Unpriced in LiteLLM',
  sessionMetaSummary: (total, archived, estimated) =>
    `${total} sessions (${archived} archived)${estimated > 0 ? ` • ${estimated} est.` : ''}`,

  tokenBreakdownTitle: 'Token Mix',
  todayPrefix: 'Today',
  classifiedTotal: 'Categorized',
  classifiedPct: 'classified',
  cacheHitLabel: 'Cache Hit',
  inputLabel: 'Input',
  outputLabel: 'Output',
  cacheLabel: 'Cache',
  reasoningLabel: 'Reasoning',
  inputShort: 'Input',
  outputShort: 'Output',
  cacheShort: 'Cache',
  reasoningShort: 'Reasoning',
  inputDesc: 'Input',
  outputDesc: 'Output',
  cacheReadDesc: 'Cache Read',
  cacheWriteDesc: 'Cache Write',
  reasoningDesc: 'Reasoning',

  heatmapTitle: 'Daily Activity Heatmap',
  heatmapSubtitle: 'Attributed by call timestamp',
  heatmapLess: 'Less',
  heatmapMore: 'More',
  dayLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  last30Days: 'Last 30 Days',
  tokenThroughput: 'Tokens',
  estimatedCostLabel: 'Est. Cost',
  messagesCountLabel: 'Messages',
  sessionsUnit: (n) => `${n} session${n === 1 ? '' : 's'}`,

  modelUsageTitle: 'Model Distribution',
  modelUsageSubtitle: 'By token volume',
  sessionsCountSuffix: 'sessions',
  emptyModels: 'No model telemetry',
  moreModels: (n) => `+ ${n} more models`,

  sessionDeckTitle: 'Sessions',
  sessionDeckSubtitle: 'Ordered by recent activity',
  colSession: 'Session',
  colMode: 'Status & Source',
  colMessages: 'Messages',
  colTotal: 'Total Tokens',
  colDelta: 'Delta',
  colPulse: 'Trend',
  statusActive: 'Active',
  statusArchived: 'Archived',
  modeReported: 'Reported',
  modeEstimated: 'Estimated',
  lastActivePrefix: 'Seen',
  emptySessions: 'No sessions recorded',
  recentActiveSessions: 'Recent Sessions',
  activeCountSuffix: 'active',
  archivedCountSuffix: 'archived',
  expandMoreSessions: (n) => `Show ${n} more`,
  collapseSessions: 'Collapse',
  emptySidebarSessions: 'No active sessions',

  coverageTitle: 'Ingestion Coverage',
  coverageSubtitle: 'RPC & Local Store',
  trackingScope: 'Scope',
  trackedSessions: 'Tracked',
  changedSessions: 'Changed',
  exportHealth: 'Export Health',
  exportedCoverage: 'Exported',
  lastExportWrite: 'Last Export',
  archivedStable: 'Archived Stable',

  systemStatusTitle: 'Pipeline Status',
  systemStatusSubtitle: 'Ingestion Worker',
  exportPipeline: 'RPC Export Pipeline',
  lastExportTime: 'Last Export',
  neverExported: 'Never',

  configTitle: 'Runtime Config',
  configSubtitle: 'Parameters',
  sessionRootLabel: 'Session Root',
  rpcExportLabel: 'RPC Auto-Export',
  stepsExportLabel: 'Steps JSONL',
  enabled: 'Enabled',
  disabled: 'Disabled',
  stepsMetaOnlyTitle: 'Steps: Metadata Only',
  stepsMetaOnlyCopy: 'Exports timestamps, models, and roles only.',

  aboutTitle: 'Accounting Spec',
  aboutSubtitle: 'Methodology',
  aboutItems: [
    { label: 'Reported', text: 'Exact payload usage from Antigravity language-server RPC.' },
    { label: 'Estimated', text: 'Heuristic byte-length fallback when RPC payloads are absent.' },
    { label: 'Cross-Session Dedup', text: 'Arbitrates responseId ownership and fuses reverted branches.' },
    { label: 'True Daily Attribution', text: 'Bins every call onto its exact local calendar date and model rate.' }
  ],

  runtimeStatusTitle: 'Status',
  dataSyncLabel: 'Sync',
  backgroundExportLabel: 'Export',
  syncingText: 'Syncing...',
  exportingText: 'Exporting...',
  notStarted: 'Idle',
  idleText: 'Idle'
};

export const i18n = derived(locale, ($locale) => ($locale === 'en' ? EN_DICT : ZH_DICT));
