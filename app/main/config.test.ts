import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig, saveConfig, DEFAULT_CONFIG } from './config';

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'idealista-cfg-'));
  file = join(dir, 'config.json');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('config', () => {
  it('returns defaults when the file does not exist', () => {
    expect(loadConfig(file)).toEqual(DEFAULT_CONFIG);
  });

  it('merges a partial file over the defaults', () => {
    writeFileSync(file, JSON.stringify({ pollIntervalMinutes: 5 }));
    const cfg = loadConfig(file);
    expect(cfg.pollIntervalMinutes).toBe(5);
    expect(cfg.notionToken).toBe(DEFAULT_CONFIG.notionToken);
  });

  it('round-trips a saved config', () => {
    const next = { ...DEFAULT_CONFIG, notionToken: 'secret_abc', launchOnStartup: true };
    saveConfig(file, next);
    expect(loadConfig(file)).toEqual(next);
  });

  it('ignores a corrupt file and returns defaults', () => {
    writeFileSync(file, '{ not json');
    expect(loadConfig(file)).toEqual(DEFAULT_CONFIG);
  });
});
