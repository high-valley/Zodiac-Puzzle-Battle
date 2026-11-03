import { describe, expect, it } from 'vitest';
import { buildLabel, latestUrl, parseBuildInfo } from '../src/version';

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

  it('読み直す URL は画面の位置（#）を残し、印は毎回変わり、積み重ならない', () => {
    const latest = { id: 'abc1234', time: '' };
    const first = latestUrl('https://example.com/Zodiac-Puzzle-Battle/#/battle/1-1', latest, 1);
    expect(first).toBe('https://example.com/Zodiac-Puzzle-Battle/?v=abc1234-1#/battle/1-1');
    const second = latestUrl(first, latest, 2);
    expect(second).toBe('https://example.com/Zodiac-Puzzle-Battle/?v=abc1234-2#/battle/1-1');
    expect(second === first).toBe(false);
    expect(latestUrl('https://example.com/a/?v=old#/', null, 5)).toBe('https://example.com/a/?v=x-5#/');
  });
});
