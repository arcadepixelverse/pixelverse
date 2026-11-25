/**
 * Outward API Key & Quota Telemetry Tracker
 * Tracks service calls and quota limits, auto-resetting daily at 00:00 UTC.
 */

export interface ServiceQuotaConfig {
  serviceKey: string;
  serviceLabel: string;
  envVar: string;
  dailyLimit: number;
  dailyLimitLabel: string;
  minuteLimitLabel: string;
  providerType: 'AI' | 'DATABASE' | 'PLATFORM';
}

export const KNOWN_SERVICES: ServiceQuotaConfig[] = [
  {
    serviceKey: 'groq',
    serviceLabel: 'GROQ LPU (TIER 1 - PRIMARY)',
    envVar: 'GROQ_API_KEY',
    dailyLimit: 14400,
    dailyLimitLabel: '14,400 RPD',
    minuteLimitLabel: '30 RPM',
    providerType: 'AI',
  },
  {
    serviceKey: 'gemini',
    serviceLabel: 'GOOGLE GEMINI 2.0 (TIER 2 - FAILOVER)',
    envVar: 'GEMINI_API_KEY',
    dailyLimit: 1500,
    dailyLimitLabel: '1,500 RPD',
    minuteLimitLabel: '15 RPM',
    providerType: 'AI',
  },
  {
    serviceKey: 'openrouter',
    serviceLabel: 'OPENROUTER (TIER 3 - EMERGENCY)',
    envVar: 'OPENROUTER_API_KEY',
    dailyLimit: 200,
    dailyLimitLabel: '200 RPD',
    minuteLimitLabel: '20 RPM',
    providerType: 'AI',
  },
  {
    serviceKey: 'supabase',
    serviceLabel: 'SUPABASE DB & AUTH (SERVICE ROLE)',
    envVar: 'SUPABASE_SERVICE_ROLE_KEY',
    dailyLimit: 50000,
    dailyLimitLabel: '50,000 RPD',
    minuteLimitLabel: '500 RPM',
    providerType: 'DATABASE',
  },
  {
    serviceKey: 'supabase_anon',
    serviceLabel: 'SUPABASE CLIENT (ANON KEY)',
    envVar: 'SUPABASE_ANON_KEY',
    dailyLimit: 50000,
    dailyLimitLabel: '50,000 RPD',
    minuteLimitLabel: '500 RPM',
    providerType: 'DATABASE',
  },
];

interface DailyTracker {
  date: string; // YYYY-MM-DD (UTC)
  counts: Record<string, number>;
  errors: Record<string, number>;
}

function getTodayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

let dailyTracker: DailyTracker = {
  date: getTodayUtc(),
  counts: {},
  errors: {},
};

function ensureCurrentDay(): void {
  const today = getTodayUtc();
  if (dailyTracker.date !== today) {
    dailyTracker = {
      date: today,
      counts: {},
      errors: {},
    };
  }
}

export function recordServiceCall(serviceKey: string, ok = true): void {
  ensureCurrentDay();
  dailyTracker.counts[serviceKey] = (dailyTracker.counts[serviceKey] || 0) + 1;
  if (!ok) {
    dailyTracker.errors[serviceKey] = (dailyTracker.errors[serviceKey] || 0) + 1;
  }
}

export function getServiceCallsToday(serviceKey: string): number {
  ensureCurrentDay();
  return dailyTracker.counts[serviceKey] || 0;
}

export function getAllServiceTelemetry(): {
  dateUtc: string;
  services: Array<{
    serviceKey: string;
    serviceLabel: string;
    envVar: string;
    status: 'CONFIGURED' | 'MISSING';
    maskedKey: string;
    dailyLimit: number;
    dailyLimitLabel: string;
    minuteLimitLabel: string;
    callsToday: number;
    errorsToday: number;
    providerType: 'AI' | 'DATABASE' | 'PLATFORM';
  }>;
  summary: {
    totalConfigured: number;
    totalServices: number;
    activeKeys: number;
    aggregateAiCallsToday: number;
    aggregateAiDailyCap: number;
  };
} {
  ensureCurrentDay();

  let totalConfigured = 0;
  let activeKeys = 0;
  let aggregateAiCallsToday = 0;
  let aggregateAiDailyCap = 0;

  const services = KNOWN_SERVICES.map((cfg) => {
    const rawVal = process.env[cfg.envVar] || '';
    const isConfigured = Boolean(rawVal && rawVal.trim().length > 0);
    if (isConfigured) {
      totalConfigured += 1;
      activeKeys += 1;
    }

    let maskedKey = 'NOT CONFIGURED';
    if (isConfigured) {
      const trimmed = rawVal.trim();
      const last4 = trimmed.slice(-4);
      maskedKey = `••••••••••••${last4}`;
    }

    const callsToday = dailyTracker.counts[cfg.serviceKey] || 0;
    const errorsToday = dailyTracker.errors[cfg.serviceKey] || 0;

    if (cfg.providerType === 'AI') {
      aggregateAiCallsToday += callsToday;
      aggregateAiDailyCap += cfg.dailyLimit;
    }

    return {
      serviceKey: cfg.serviceKey,
      serviceLabel: cfg.serviceLabel,
      envVar: cfg.envVar,
      status: isConfigured ? ('CONFIGURED' as const) : ('MISSING' as const),
      maskedKey,
      dailyLimit: cfg.dailyLimit,
      dailyLimitLabel: cfg.dailyLimitLabel,
      minuteLimitLabel: cfg.minuteLimitLabel,
      callsToday,
      errorsToday,
      providerType: cfg.providerType,
    };
  });

  return {
    dateUtc: dailyTracker.date,
    services,
    summary: {
      totalConfigured,
      totalServices: KNOWN_SERVICES.length,
      activeKeys,
      aggregateAiCallsToday,
      aggregateAiDailyCap,
    },
  };
}
