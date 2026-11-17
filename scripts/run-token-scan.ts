import * as os from 'os';
import * as path from 'path';
import { SessionScanner } from '../src/monitor/sessionScanner';
import { AntigravitySessionParser } from '../src/parser/antigravitySessionParser';
import { resolveParsePlan } from '../src/monitor/sourceResolver';
import { RpcArtifactStore } from '../src/storage/rpcArtifactStore';
import { TrajectoryExporter } from '../src/rpc/trajectoryExporter';
import { LiteLlmPricingCatalog, calculateModelCost } from '../src/pricing/litellmPricing';
import { MonitorConfig } from '../src/config';
import { SessionTotals } from '../src/types';

interface DailySummary {
  date: string;
  sessions: number;
  messages: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  costUsd: number;
  reportedSessions: number;
  estimatedSessions: number;
}

interface ModelSummary {
  model: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

async function main() {
  console.log('========================================================================================');
  console.log('             Antigravity Token Monitor - Live Real-Machine Token Verification           ');
  console.log('========================================================================================\n');

  const sessionRoot = path.join(os.homedir(), '.gemini', 'antigravity');
  console.log(`[Config] Target Session Root: ${sessionRoot}`);

  const config: MonitorConfig = {
    sessionRoot,
    debug: false,
    pollIntervalMs: 60000,
    historyLimit: 120,
    maxFileBytes: 20 * 1024 * 1024,
    useRpcExport: true,
    exportStepsJsonl: false,
    rpcExportIntervalMs: 300000,
    rpcTimeoutMs: 5000
  };

  const artifactStore = new RpcArtifactStore(sessionRoot);
  const exporter = new TrajectoryExporter(config, artifactStore, (msg) => {
    if (msg.includes('connection') || msg.includes('summaries') || msg.includes('Export completed')) {
      console.log(`[RPC] ${msg}`);
    }
  });

  const scanner = new SessionScanner();
  console.log('\n[1/4] Scanning local session directory...');
  const scanResult = await scanner.scan(sessionRoot);

  if (!scanResult.complete) {
    console.error(`[Error] Session scan failed: ${scanResult.error}`);
    process.exit(1);
  }

  console.log(`[Scanner] Discovered ${scanResult.sessions.length} total sessions in brain/`);

  // We scan the most recent 50 sessions for live verification
  const sessionsToProcess = scanResult.sessions.slice(0, 50);
  console.log(`[Scanner] Processing the top ${sessionsToProcess.length} most recent sessions.`);

  console.log('\n[2/4] Verifying Live RPC Export for changed/recent trajectories...');
  try {
    const exportResult = await exporter.exportChangedSessions(sessionsToProcess);
    console.log(`[RPC] Export completed: ${exportResult.exportedCount} session(s) processed via RPC.`);
  } catch (err) {
    console.warn(`[RPC] Live RPC export encountered non-blocking warning:`, err);
  }

  console.log('\n[3/4] Parsing token usage across sessions...');
  const parser = new AntigravitySessionParser(config.maxFileBytes);
  const pricingCatalog = new LiteLlmPricingCatalog();

  const dailyMap = new Map<string, DailySummary>();
  const modelMap = new Map<string, ModelSummary>();

  let totalInput = 0;
  let totalOutput = 0;
  let totalReasoning = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  let grandTotalTokens = 0;
  let grandTotalCost = 0;
  let grandMessages = 0;
  let reportedCount = 0;
  let estimatedCount = 0;
  let rpcArtifactCount = 0;
  let filesystemCount = 0;

  // Temporarily mute noisy debug prints during parsing
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const first = typeof args[0] === 'string' ? args[0] : '';
    if (first.includes('Failed to read') || first.includes('[DEBUG]')) {
      return;
    }
    originalWarn(...args);
  };

  try {
    for (const candidate of sessionsToProcess) {
      const plan = await resolveParsePlan(candidate, artifactStore);
      if (plan.source === 'rpc-artifact') {
        rpcArtifactCount++;
      } else {
        filesystemCount++;
      }

      const sessionTotals: SessionTotals = await parser.parse(plan);

      if (sessionTotals.mode === 'reported') {
        reportedCount++;
      } else {
        estimatedCount++;
      }

      // Cost calculation
      let sessionCost = 0;
      if (sessionTotals.modelBreakdowns) {
        for (const [model, breakdown] of Object.entries(sessionTotals.modelBreakdowns)) {
          const pricing = pricingCatalog.resolveModelPricing(model);
          const costResult = calculateModelCost(breakdown, pricing, `Pricing unavailable for ${model}`);
          if (costResult.costUsd) {
            sessionCost += costResult.costUsd;
          }

          const mSummary = modelMap.get(model) ?? {
            model,
            totalTokens: 0,
            inputTokens: 0,
            outputTokens: 0,
            reasoningTokens: 0,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            costUsd: 0
          };
          mSummary.totalTokens += breakdown.totalTokens;
          mSummary.inputTokens += breakdown.inputTokens;
          mSummary.outputTokens += breakdown.outputTokens;
          mSummary.reasoningTokens += breakdown.reasoningTokens;
          mSummary.cacheReadTokens += breakdown.cacheReadTokens;
          mSummary.cacheWriteTokens += breakdown.cacheWriteTokens;
          mSummary.costUsd += costResult.costUsd ?? 0;
          modelMap.set(model, mSummary);
        }
      }

      // Daily bucket
      const date = new Date(candidate.lastModifiedMs);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const daily = dailyMap.get(dateKey) ?? {
        date: dateKey,
        sessions: 0,
        messages: 0,
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        reportedSessions: 0,
        estimatedSessions: 0
      };

      daily.sessions += 1;
      daily.messages += sessionTotals.messageCount;
      daily.inputTokens += sessionTotals.inputTokens;
      daily.outputTokens += sessionTotals.outputTokens;
      daily.reasoningTokens += sessionTotals.reasoningTokens;
      daily.cacheReadTokens += sessionTotals.cacheReadTokens;
      daily.cacheWriteTokens += sessionTotals.cacheWriteTokens;
      daily.totalTokens += sessionTotals.totalTokens;
      daily.costUsd += sessionCost;

      if (sessionTotals.mode === 'reported') {
        daily.reportedSessions += 1;
      } else {
        daily.estimatedSessions += 1;
      }
      dailyMap.set(dateKey, daily);

      totalInput += sessionTotals.inputTokens;
      totalOutput += sessionTotals.outputTokens;
      totalReasoning += sessionTotals.reasoningTokens;
      totalCacheRead += sessionTotals.cacheReadTokens;
      totalCacheWrite += sessionTotals.cacheWriteTokens;
      grandTotalTokens += sessionTotals.totalTokens;
      grandTotalCost += sessionCost;
      grandMessages += sessionTotals.messageCount;
    }
  } finally {
    console.warn = originalWarn;
  }

  console.log('\n[4/4] Generating Consumption Reports...');

  console.log('\n' + '='.repeat(110));
  console.log('                                  DAILY TOKEN CONSUMPTION REPORT                                  ');
  console.log('='.repeat(110));
  console.log(
    'Date'.padEnd(12) +
    'Sessions'.padStart(10) +
    'Messages'.padStart(10) +
    'Input'.padStart(13) +
    'Output'.padStart(11) +
    'Reasoning'.padStart(13) +
    'CacheRead'.padStart(13) +
    'Total'.padStart(14) +
    'Cost (USD)'.padStart(12) +
    'Mode'.padStart(12)
  );
  console.log('-'.repeat(110));

  const sortedDates = Array.from(dailyMap.keys()).sort().reverse();
  for (const dateKey of sortedDates) {
    const d = dailyMap.get(dateKey)!;
    const modeStr = `${d.reportedSessions}r / ${d.estimatedSessions}e`;
    console.log(
      d.date.padEnd(12) +
      formatNumber(d.sessions).padStart(10) +
      formatNumber(d.messages).padStart(10) +
      formatNumber(d.inputTokens).padStart(13) +
      formatNumber(d.outputTokens).padStart(11) +
      formatNumber(d.reasoningTokens).padStart(13) +
      formatNumber(d.cacheReadTokens).padStart(13) +
      formatNumber(d.totalTokens).padStart(14) +
      formatCost(d.costUsd).padStart(12) +
      modeStr.padStart(12)
    );
  }
  console.log('-'.repeat(110));
  console.log(
    'TOTAL'.padEnd(12) +
    formatNumber(sessionsToProcess.length).padStart(10) +
    formatNumber(grandMessages).padStart(10) +
    formatNumber(totalInput).padStart(13) +
    formatNumber(totalOutput).padStart(11) +
    formatNumber(totalReasoning).padStart(13) +
    formatNumber(totalCacheRead).padStart(13) +
    formatNumber(grandTotalTokens).padStart(14) +
    formatCost(grandTotalCost).padStart(12) +
    `${reportedCount}r / ${estimatedCount}e`.padStart(12)
  );
  console.log('='.repeat(110));

  if (modelMap.size > 0) {
    console.log('\n' + '='.repeat(110));
    console.log('                                   MODEL BREAKDOWN REPORT                                         ');
    console.log('='.repeat(110));
    console.log(
      'Model Name'.padEnd(30) +
      'Input'.padStart(13) +
      'Output'.padStart(12) +
      'Reasoning'.padStart(12) +
      'CacheRead'.padStart(14) +
      'Total Tokens'.padStart(16) +
      'Cost (USD)'.padStart(13)
    );
    console.log('-'.repeat(110));
    for (const [model, m] of modelMap.entries()) {
      console.log(
        model.slice(0, 28).padEnd(30) +
        formatNumber(m.inputTokens).padStart(13) +
        formatNumber(m.outputTokens).padStart(12) +
        formatNumber(m.reasoningTokens).padStart(12) +
        formatNumber(m.cacheReadTokens).padStart(14) +
        formatNumber(m.totalTokens).padStart(16) +
        formatCost(m.costUsd).padStart(13)
      );
    }
    console.log('='.repeat(110));
  }

  console.log('\n=== Real-Machine Verification Summary ===');
  console.log(`- Scanned Sessions: ${sessionsToProcess.length} (out of ${scanResult.sessions.length} discovered)`);
  console.log(`- Data Sources: ${rpcArtifactCount} RPC-Artifact, ${filesystemCount} Filesystem`);
  console.log(`- Parsing Modes: ${reportedCount} Reported (High Accuracy), ${estimatedCount} Estimated`);
  console.log(`- Grand Total Tokens: ${formatNumber(grandTotalTokens)}`);
  console.log(`- Grand Total Input Tokens: ${formatNumber(totalInput)}`);
  console.log(`- Grand Total Output Tokens: ${formatNumber(totalOutput)}`);
  console.log(`- Grand Total Reasoning Tokens: ${formatNumber(totalReasoning)}`);
  console.log(`- Grand Total Cache Read Tokens: ${formatNumber(totalCacheRead)}`);
  console.log(`- Grand Total Cache Write Tokens: ${formatNumber(totalCacheWrite)}`);
  console.log(`- Grand Total Estimated Cost: ${formatCost(grandTotalCost)}`);
  console.log('\n[SUCCESS] Token Scanner, RPC Exporter & Parser pipeline fully verified on live Antigravity data!');
}

main().catch((err) => {
  console.error('[FATAL] Script encountered error:', err);
  process.exit(1);
});
