import { describe, expect, it } from 'vitest';
import { buildLabel, parseBuildInfo } from '../src/version';

describe('アプリの版', () => {
  it('ビルドの日時とコミットの印で版を表す', () => {
    const label = buildLabel({ id: 'e73ec03', time: '2026-11-03T03:30:00.000Z' });
    expect(label.endsWith('版（e73ec03）')).toBe(true);
    expect(/^\d{4}\/\d{1,2}\/\d{1,2} \d{2}:\d{2} 版/.test(label)).toBe(true);
    expect(buildLabel({ id: 'dev', time: '' })).toBe('開発版（dev）');
  });

  it('version.json の中身を確かめる（壊れたものは null）', () => {
    expect(parseBuildInfo({ id: 'abc1234', time: '2026-11-03T03:30:00.000Z' })).toEqual({ id: 'abc1234', time: '2026-11-03T03:30:00.000Z' });
    for (const bad of [null, 'x', { id: 1, time: '' }, { id: '<script>', time: '' }, { id: 'abc' }]) expect(parseBuildInfo(bad)).toBeNull();
  });
});
