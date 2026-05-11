import { Injectable } from '@nestjs/common';
import type { MetricsResponse } from 'shared-contracts';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  private totalRequests = 0;
  private totalErrors = 0;
  private totalLatencyMs = 0;
  private readonly registry = new Registry();
  private readonly requestCounter: Counter<'status_class'>;
  private readonly errorCounter: Counter<string>;
  private readonly latencyHistogram: Histogram<string>;

  constructor() {
    collectDefaultMetrics({ register: this.registry });
    this.requestCounter = new Counter({
      name: 'swimsync_http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['status_class'],
      registers: [this.registry],
    });
    this.errorCounter = new Counter({
      name: 'swimsync_http_errors_total',
      help: 'Total HTTP errors',
      registers: [this.registry],
    });
    this.latencyHistogram = new Histogram({
      name: 'swimsync_http_latency_ms',
      help: 'HTTP latency in milliseconds',
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
      registers: [this.registry],
    });
  }

  recordRequest(durationMs: number, isError: boolean): void {
    this.totalRequests += 1;
    this.totalLatencyMs += durationMs;
    if (isError) this.totalErrors += 1;
    this.requestCounter.inc({ status_class: isError ? '4xx_5xx' : '2xx_3xx' });
    if (isError) {
      this.errorCounter.inc();
    }
    this.latencyHistogram.observe(durationMs);
  }

  snapshot(): MetricsResponse {
    const memoryRssMb = Math.round((process.memoryUsage().rss / (1024 * 1024)) * 100) / 100;
    return {
      processUptimeSec: Math.round(process.uptime()),
      memoryRssMb,
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      averageLatencyMs:
        this.totalRequests === 0 ? 0 : Math.round((this.totalLatencyMs / this.totalRequests) * 100) / 100,
    };
  }

  async renderPrometheus(): Promise<string> {
    return this.registry.metrics();
  }
}

