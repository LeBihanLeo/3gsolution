// TICK-059 — SEC-09 : Logs de sécurité structurés (OWASP A09:2021)
// Wrapper léger avec niveaux de sévérité, timestamp ISO, et contexte structuré.
//
// Usage :
//   logger.warn('login_rate_limited', { ip: '1.2.3.4', route: '/api/auth/...' })
//   logger.error('webhook_error', { stripeSessionId: 'cs_xxx' }, err)
//
// En production : les logs sont émis en JSON sur stdout → compatibles Vercel Log Drain,
// Axiom, Logtail, ou tout service external configuré via Vercel (TICK-059 post-MVP).
// En développement : format lisible avec couleurs.

type LogLevel = 'info' | 'warn' | 'error';

type LogContext = Record<string, string | number | boolean | undefined | null>;

interface LogEntry {
  level: LogLevel;
  event: string;
  timestamp: string;
  env: string;
  context?: LogContext;
  error?: string;
}

const isDev = process.env.NODE_ENV !== 'production';

function emit(level: LogLevel, event: string, context?: LogContext, err?: unknown): void {
  const entry: LogEntry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV ?? 'unknown',
    ...(context ? { context } : {}),
    ...(err ? { error: err instanceof Error ? err.message : String(err) } : {}),
  };

  if (isDev) {
    // Format lisible en développement
    const prefix =
      level === 'error' ? '🔴 [ERROR]' :
      level === 'warn'  ? '🟡 [WARN] ' :
                          '🔵 [INFO] ';
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    const errorStr = entry.error ? ` — ${entry.error}` : '';
    console[level](`${prefix} ${entry.timestamp} ${event}${contextStr}${errorStr}`);
  } else {
    // Format JSON structuré en production (Vercel Log Drain compatible)
    console[level](JSON.stringify(entry));
  }
}

export const logger = {
  info(event: string, context?: LogContext): void {
    emit('info', event, context);
  },

  warn(event: string, context?: LogContext): void {
    emit('warn', event, context);
  },

  error(event: string, context?: LogContext, err?: unknown): void {
    emit('error', event, context, err);
  },
};
