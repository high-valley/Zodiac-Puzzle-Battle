import { describe, expect, it } from 'vitest';
import { ALL_HEROES } from '../src/data/heroes';
import { ALL_STAGES } from '../src/data/stages';
import { EXPRESSIONS, SCENES, STAGE_SCENES, STORY_NAME } from '../src/data/story';
import { hashToRoute, routeToHash, type Route } from '../src/routes';
import { emptyProgress, markSceneSeen, parseProgress, sceneSeen } from '../src/storage/progress';

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
    for (const s of ALL_STAGES.filter((s) => s.chapter === 1)) {
      expect(!!STAGE_SCENES[s.id]?.before && !!STAGE_SCENES[s.id]?.after).toBe(true);
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
