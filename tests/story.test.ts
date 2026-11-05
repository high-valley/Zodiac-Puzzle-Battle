import { describe, expect, it } from 'vitest';
import { ALL_HEROES } from '../src/data/heroes';
import { ALL_STAGES } from '../src/data/stages';
import { EXPRESSIONS, SCENES, STAGE_SCENES, STORY_NAME, findStoryNode } from '../src/data/story';
import { hashToRoute, routeToHash, type Route } from '../src/routes';
import { canViewScene, emptyProgress, markSceneSeen, parseProgress, sceneAfterWin, sceneBeforeBattle, sceneSeen, sceneStage, scenesToReplay, waitsForPrologue } from '../src/storage/progress';

describe('ストーリーの会話（docs/story.md）', () => {
  it('場面の id と中身がそろっていて、話す人・表情が正しい', () => {
    for (const [id, scene] of Object.entries(SCENES)) {
      expect(scene.id).toBe(id);
      expect(scene.lines.length > 0).toBe(true);
      for (const line of scene.lines) {
        if (line.who) expect(ALL_HEROES.includes(line.who)).toBe(true);
        if (line.face) expect(EXPRESSIONS.includes(line.face)).toBe(true);
        expect(line.text.length > 0).toBe(true);
      }
    }
    for (const id of ALL_HEROES) expect(STORY_NAME[id].length > 0).toBe(true);
  });

  it('ステージの前後の会話は、あるステージとある場面を指す。第1章は5つとも前後がある', () => {
    for (const [stageId, sc] of Object.entries(STAGE_SCENES)) {
      expect(ALL_STAGES.some((s) => s.id === stageId)).toBe(true);
      for (const id of [sc.before, sc.after]) if (id) expect(id in SCENES).toBe(true);
    }
    // 1-1 の前はストーリーだけのマス（プロローグ）なので、前の会話は 1-2 から
    for (const s of ALL_STAGES.filter((s) => s.chapter === 1)) {
      expect(!!STAGE_SCENES[s.id]?.after).toBe(true);
      expect(!!STAGE_SCENES[s.id]?.before).toBe(s.id !== '1-1');
    }
  });

  it('会話の行き先は URL と行き来できる', () => {
    const routes: Route[] = [
      { name: 'story', sceneId: 'ch1-prologue', next: { name: 'battle', stageId: '1-1' } },
      { name: 'story', sceneId: 'ch1-end', next: { name: 'quest', stageId: '1-5' } },
      { name: 'story', sceneId: 'ch1-2-before', next: { name: 'quest' } },
    ];
    for (const r of routes) expect(hashToRoute(routeToHash(r))).toEqual(r);
  });

  it('見た会話を記録し、保存から読み戻せる（知らない id は捨てる。前の版の保存には無くてよい）', () => {
    const p = markSceneSeen(markSceneSeen(emptyProgress(), 'ch1-prologue'), 'ch1-prologue');
    expect(p.seenScenes).toEqual(['ch1-prologue']);
    expect(sceneSeen(p, 'ch1-prologue')).toBe(true);
    expect(sceneSeen(emptyProgress(), 'ch1-prologue')).toBe(false);
    const back = parseProgress(JSON.stringify({ ...p, seenScenes: ['ch1-prologue', 'nope', 3] }));
    expect(back.seenScenes).toEqual(['ch1-prologue']);
    expect(parseProgress(JSON.stringify(emptyProgress())).seenScenes === undefined).toBe(true);
  });
});

describe('会話を出すときの判定（仕様書 11.17）', () => {
  const cleared = (id: string) => ({ ...emptyProgress(), stages: { [id]: { stars: 1, bestTurns: 5 } } });
  it('出撃：見ていない前の会話だけ。途中のバトルの続きならとばす', () => {
    expect(sceneBeforeBattle(emptyProgress(), '1-1', false)).toBe(null);
    expect(sceneBeforeBattle(emptyProgress(), '1-2', false)).toBe('ch1-2-before');
    expect(sceneBeforeBattle(emptyProgress(), '1-2', true)).toBe(null);
    expect(sceneBeforeBattle(markSceneSeen(emptyProgress(), 'ch1-2-before'), '1-2', false)).toBe(null);
  });
  it('勝ったあと：見ていない後の会話だけ。負けたときは出さない', () => {
    expect(sceneAfterWin(emptyProgress(), '1-5', true)).toBe('ch1-end');
    expect(sceneAfterWin(emptyProgress(), '1-5', false)).toBe(null);
    expect(sceneAfterWin(markSceneSeen(emptyProgress(), 'ch1-end'), '1-5', true)).toBe(null);
  });
  it('開いてよい会話：前はステージが開いていれば、後はクリアしていれば', () => {
    const open = (id: string) => id === '1-1';
    expect(canViewScene(emptyProgress(), 'ch1-prologue', open)).toBe(true);
    expect(canViewScene(emptyProgress(), 'ch1-1-after', open)).toBe(false);
    expect(canViewScene(cleared('1-1'), 'ch1-1-after', open)).toBe(true);
    expect(canViewScene(emptyProgress(), 'ch1-end', open)).toBe(false);
    expect(canViewScene(emptyProgress(), 'nope', open)).toBe(false);
  });
  it('見直せる会話：見た前の会話と、クリアしたステージの後の会話', () => {
    expect(scenesToReplay(emptyProgress(), '1-1')).toEqual([]);
    expect(scenesToReplay(cleared('1-1'), '1-1')).toEqual(['ch1-1-after']);
    expect(scenesToReplay(markSceneSeen(cleared('1-2'), 'ch1-2-before'), '1-2')).toEqual(['ch1-2-before', 'ch1-2-after']);
  });
  it('保存の seenScenes が配列でなければ無視する', () => {
    for (const v of ['ch1-prologue', null, 3, { a: 1 }]) {
      expect(parseProgress(JSON.stringify({ ...emptyProgress(), seenScenes: v })).seenScenes === undefined).toBe(true);
    }
  });
});

describe('会話用の上半身の絵', () => {
  it('登録した絵のファイルがすべてある', async () => {
    const { existsSync } = await import('node:fs');
    const { PORTRAIT_ART } = await import('../src/data/story');
    for (const faces of Object.values(PORTRAIT_ART)) {
      for (const f of Object.values(faces ?? {})) expect(existsSync(`public/${f!.split('?')[0]}`)).toBe(true);
    }
  });
});

describe('クリアしたステージの会話をとばす設定（2026-11-05）', () => {
  const cleared = { ...emptyProgress(), stages: { '1-1': { stars: 2, bestTurns: 5 }, '1-2': { stars: 1, bestTurns: 9 } } };
  it('設定が「とばす」なら、クリア済みのステージの前の会話を出さない', () => {
    expect(sceneBeforeBattle(cleared, '1-2', false, false)).toBe('ch1-2-before');
    expect(sceneBeforeBattle(cleared, '1-2', false, true)).toBe(null);
    expect(sceneBeforeBattle(emptyProgress(), '1-2', false, true)).toBe('ch1-2-before');
  });
  it('後の会話は、初めてクリアしたときだけ出す（とばす設定のとき）', () => {
    expect(sceneAfterWin(cleared, '1-1', true, true, true)).toBe('ch1-1-after');
    expect(sceneAfterWin(cleared, '1-1', true, true, false)).toBe(null);
    expect(sceneAfterWin(cleared, '1-1', true, false, false)).toBe('ch1-1-after');
  });
});

describe('プロローグのマス（2026-11-05）', () => {
  it('プロローグは 1-1 の手前のストーリーだけのマス。見るまでは 1-1 を待たせる（記録や途中のバトルがあれば待たせない）', () => {
    expect(findStoryNode('prologue')?.sceneId).toBe('ch1-prologue');
    expect(waitsForPrologue(emptyProgress(), '1-1')).toBe(true);
    expect(waitsForPrologue(markSceneSeen(emptyProgress(), 'ch1-prologue'), '1-1')).toBe(false);
    expect(waitsForPrologue({ ...emptyProgress(), stages: { '1-1': { stars: 1, bestTurns: 6 } } }, '1-1')).toBe(false);
    expect(waitsForPrologue(emptyProgress(), '1-2')).toBe(false);
    // 途中のバトルだけある人も待たせない
    const battle = { stageId: '1-1', state: {} as never, pending: [] };
    expect(waitsForPrologue({ ...emptyProgress(), battle }, '1-1')).toBe(false);
  });
  it('プロローグはいつでも見られる', () => {
    expect(canViewScene(emptyProgress(), 'ch1-prologue', (id) => id === '1-1')).toBe(true);
    expect(canViewScene(emptyProgress(), 'ch1-prologue', () => false)).toBe(false);
    expect(sceneStage('ch1-prologue')).toEqual({ stageId: '1-1', when: 'node' });
    expect(hashToRoute('#/quest/prologue')).toEqual({ name: 'quest', stageId: 'prologue' });
  });
});
