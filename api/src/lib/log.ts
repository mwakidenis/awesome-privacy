/**
 * Structured logger util used everywhere in the API
 * When running in TTY or dev, you get pretty output
 * In prod it's structured JSON for log aggregation
 */

/* eslint-disable no-console */

type Level = 'info' | 'warn' | 'error'

const colour: Record<Level, string> = {
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
}
const dim = '\x1b[2m'
const reset = '\x1b[0m'

// Detect if running in a real terminal. Will be false for Workers/Docker
const isTty = typeof process !== 'undefined' && Boolean(process.stdout?.isTTY)

// Coloured single-line format for local dev terminals
const pretty = (level: Level, msg: string, meta?: Record<string, unknown>) => {
  const time = new Date().toISOString().slice(11, 19)
  const tag = `${colour[level]}${level.toUpperCase().padEnd(5)}${reset}`
  const extra =
    meta && Object.keys(meta).length ? ` ${dim}${JSON.stringify(meta)}${reset}` : ''
  return `${dim}${time}${reset} ${tag} ${msg}${extra}`
}

// JSON line for log aggregators, Docker stdout, Workers tail
const json = (level: Level, msg: string, meta?: Record<string, unknown>) =>
  JSON.stringify({ t: new Date().toISOString(), level, msg, ...meta })

const emit = (level: Level, msg: string, meta?: Record<string, unknown>) => {
  const line = isTty ? pretty(level, msg, meta) : json(level, msg, meta)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

// Main logger. Used like: `log.info('hello', { something: 123 })`
export const log = {
  info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),
}
