#!/usr/bin/env node

import { existsSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

const options = parseArgs(process.argv.slice(2));
const screenshotPath = path.resolve(options.screenshot);
const screenshotDir = path.dirname(screenshotPath);

if (options.help) usage(0);
if (!existsSync(screenshotDir)) {
  mkdirSync(screenshotDir, { recursive: true });
}

const consoleIssues = [];
const pageErrors = [];
const requestFailures = [];
const externalRequests = [];

let browser;
let failed = false;

try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: options.width, height: options.height },
  });

  page.on('console', (message) => {
    const type = message.type();
    if (type === 'error' || (!options.allowWarnings && type === 'warning')) {
      consoleIssues.push(`${type}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(String(error));
  });
  page.on('request', (request) => {
    if (isExternalRequest(request.url(), options.url) && !options.allowExternal) {
      externalRequests.push(request.url());
    }
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    requestFailures.push(`${request.url()} ${failure?.errorText || 'request failed'}`);
  });

  const response = await page.goto(options.url, {
    waitUntil: 'domcontentloaded',
    timeout: options.timeoutMs,
  });
  await page.waitForTimeout(options.settleMs);

  const title = await page.title();
  const bodyText = (await page.locator('body').innerText({ timeout: options.timeoutMs })).trim();
  const bodyLength = bodyText.length;
  const frameworkOverlay = await hasFrameworkOverlay(page);
  const status = response?.status() ?? null;

  if (!response || status === null || status >= 400) {
    fail(`http_status=${status ?? 'missing'}`);
  }
  if (title !== options.expectedTitle) {
    fail(`title_mismatch expected=${JSON.stringify(options.expectedTitle)} actual=${JSON.stringify(title)}`);
  }
  if (bodyLength < options.minBodyChars) {
    fail(`blank_or_too_small_body chars=${bodyLength}`);
  }
  if (frameworkOverlay) {
    fail('framework_overlay_detected');
  }
  if (consoleIssues.length > 0) {
    fail(`console_issues=${consoleIssues.length}`);
  }
  if (pageErrors.length > 0) {
    fail(`page_errors=${pageErrors.length}`);
  }
  if (requestFailures.length > 0 && !options.allowRequestFailures) {
    fail(`request_failures=${requestFailures.length}`);
  }
  if (externalRequests.length > 0) {
    fail(`external_requests=${externalRequests.length}`);
  }

  await page.screenshot({ path: screenshotPath, fullPage: false });

  console.log('# AssistantCaddy Standalone Smoke');
  console.log(`url: ${options.url}`);
  console.log(`status_code: ${status ?? 'missing'}`);
  console.log(`title: ${title}`);
  console.log(`body_chars: ${bodyLength}`);
  console.log(`framework_overlay: ${frameworkOverlay ? 'yes' : 'no'}`);
  console.log(`console_issues: ${consoleIssues.length}`);
  console.log(`page_errors: ${pageErrors.length}`);
  console.log(`request_failures: ${requestFailures.length}`);
  console.log(`external_requests: ${externalRequests.length}`);
  console.log(`screenshot: ${screenshotPath}`);
  emitSamples('console_issue', consoleIssues);
  emitSamples('page_error', pageErrors);
  emitSamples('request_failure', requestFailures);
  emitSamples('external_request', externalRequests);
  console.log(`status: ${failed ? 'fail' : 'pass'}`);
} catch (error) {
  fail(`smoke_exception=${String(error)}`);
  console.log('# AssistantCaddy Standalone Smoke');
  console.log(`url: ${options.url}`);
  console.log(`screenshot: ${screenshotPath}`);
  console.log(`status: fail`);
  console.log(`error: ${String(error)}`);
} finally {
  if (browser) await browser.close();
}

process.exit(failed ? 1 : 0);

async function hasFrameworkOverlay(page) {
  const markers = [
    'vite-error-overlay',
    'nextjs-portal',
    'webpack-dev-server-client-overlay',
  ];
  for (const marker of markers) {
    if ((await page.locator(marker).count()) > 0) return true;
  }

  const bodyText = await page.locator('body').innerText().catch(() => '');
  return /Internal server error|Failed to compile|Unhandled Runtime Error|Vite Error/i.test(bodyText);
}

function isExternalRequest(requestUrl, baseUrl) {
  let parsed;
  let base;
  try {
    parsed = new URL(requestUrl);
    base = new URL(baseUrl);
  } catch {
    return false;
  }

  if (parsed.protocol === 'data:' || parsed.protocol === 'blob:') return false;
  if (parsed.protocol === 'file:') return base.protocol !== 'file:';
  if (base.protocol === 'file:') return parsed.protocol !== 'file:';
  if (parsed.origin === base.origin) return false;
  return !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname);
}

function emitSamples(label, values) {
  values.slice(0, 8).forEach((value, index) => {
    console.log(`${label}_${index + 1}: ${truncate(value, options.maxLineChars)}`);
  });
}

function fail(reason) {
  failed = true;
  console.error(`error: ${reason}`);
}

function parseArgs(args) {
  const parsed = {
    allowExternal: false,
    allowRequestFailures: false,
    allowWarnings: false,
    expectedTitle: 'ThreatCaddy',
    height: 900,
    help: false,
    maxLineChars: 700,
    minBodyChars: 200,
    screenshot: path.join(os.tmpdir(), 'threatcaddy-standalone-smoke.png'),
    settleMs: 1500,
    timeoutMs: 30000,
    url: 'http://127.0.0.1:4181/threatcaddy-standalone.html',
    width: 1440,
  };

  for (const arg of args) {
    if (arg === '--') continue;
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    if (arg === '--allow-external') {
      parsed.allowExternal = true;
      continue;
    }
    if (arg === '--allow-request-failures') {
      parsed.allowRequestFailures = true;
      continue;
    }
    if (arg === '--allow-warnings') {
      parsed.allowWarnings = true;
      continue;
    }
    if (setStringOption(parsed, arg, '--url=', 'url')) continue;
    if (setStringOption(parsed, arg, '--screenshot=', 'screenshot')) continue;
    if (setStringOption(parsed, arg, '--expected-title=', 'expectedTitle')) continue;
    if (setNumberOption(parsed, arg, '--width=', 'width', 320)) continue;
    if (setNumberOption(parsed, arg, '--height=', 'height', 320)) continue;
    if (setNumberOption(parsed, arg, '--timeout-ms=', 'timeoutMs', 1000)) continue;
    if (setNumberOption(parsed, arg, '--settle-ms=', 'settleMs', 0)) continue;
    if (setNumberOption(parsed, arg, '--min-body-chars=', 'minBodyChars', 1)) continue;
    if (setNumberOption(parsed, arg, '--max-line-chars=', 'maxLineChars', 80)) continue;
    if (arg.startsWith('--')) usage(2, `Unknown option: ${arg}`);
  }

  return parsed;
}

function setStringOption(parsed, arg, prefix, key) {
  if (!arg.startsWith(prefix)) return false;
  const value = arg.slice(prefix.length);
  if (!value) usage(2, `${prefix} requires a value.`);
  parsed[key] = value;
  return true;
}

function setNumberOption(parsed, arg, prefix, key, min) {
  if (!arg.startsWith(prefix)) return false;
  const value = Number.parseInt(arg.slice(prefix.length), 10);
  if (!Number.isFinite(value) || value < min) usage(2, `${prefix} requires a number >= ${min}.`);
  parsed[key] = value;
  return true;
}

function truncate(value, maxLineChars) {
  return value.length > maxLineChars ? `${value.slice(0, maxLineChars)}...` : value;
}

function usage(exitCode, message) {
  if (message) console.error(message);
  console.error('Usage: node scripts/assistantcaddy-standalone-smoke.mjs [--url=<url>] [--screenshot=<path>] [--expected-title=<title>] [--width=<px>] [--height=<px>] [--timeout-ms=<ms>] [--settle-ms=<ms>] [--min-body-chars=<n>] [--allow-warnings] [--allow-request-failures] [--allow-external]');
  process.exit(exitCode);
}
