/**
 * 提醒正文：时段分档与轮换。
 *
 * 这两件事都必须是纯函数，否则「凌晨两点该说什么」会变成依赖真实时钟的 flaky 测试。
 *
 * 运行： node --test test/reminder-copy.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers.mjs';

const COPY = loadModule('reminder-copy.js');
const DICT = loadModule('dict.js');

test('时段边界：22 点进入深夜，5 点回到早晨', () => {
  assert.equal(COPY.reminderBucketFor(21), 'evening');
  assert.equal(COPY.reminderBucketFor(22), 'night');
  assert.equal(COPY.reminderBucketFor(23), 'night');
  assert.equal(COPY.reminderBucketFor(0), 'night');
  assert.equal(COPY.reminderBucketFor(4), 'night');
  assert.equal(COPY.reminderBucketFor(5), 'morning');
  assert.equal(COPY.reminderBucketFor(8), 'morning');
  assert.equal(COPY.reminderBucketFor(9), 'day');
  assert.equal(COPY.reminderBucketFor(16), 'day');
  assert.equal(COPY.reminderBucketFor(17), 'evening');
});

test('非法小时按白天处理，不抛错', () => {
  assert.equal(COPY.reminderBucketFor(NaN), 'day');
  assert.equal(COPY.reminderBucketFor(undefined), 'day');
  assert.equal(COPY.reminderBucketFor(24), 'night');
  assert.equal(COPY.reminderBucketFor(-1), 'night');
});

test('轮换：0→1→2→0，且连续两次不同', () => {
  const keys = [0, 1, 2, 3, 4].map((seq) => COPY.reminderLine(10, seq).key);
  assert.deepEqual(keys, [
    'hud.alert.line.day.1',
    'hud.alert.line.day.2',
    'hud.alert.line.day.3',
    'hud.alert.line.day.1',
    'hud.alert.line.day.2',
  ]);
  for (let i = 1; i < keys.length; i += 1) assert.notEqual(keys[i], keys[i - 1]);
});

test('轮换接受负数与非整数', () => {
  assert.equal(COPY.reminderLine(10, -1).index, 2);
  assert.equal(COPY.reminderLine(10, 4.9).index, 1);
});

test('12 条文案中英都存在，且没有空串', () => {
  for (const bucket of ['night', 'morning', 'day', 'evening']) {
    for (let i = 1; i <= 3; i += 1) {
      const key = `hud.alert.line.${bucket}.${i}`;
      for (const [lang, table] of [['zh', DICT.ZH], ['en', DICT.EN]]) {
        const value = table[key];
        assert.equal(typeof value, 'string', `${lang} 缺 ${key}`);
        assert.ok(value.trim().length > 0, `${lang} 的 ${key} 是空串`);
      }
    }
  }
});

test('旧的固定正文已移除，避免两套文案并存', () => {
  assert.equal(DICT.ZH['hud.alert.card.body'], undefined);
  assert.equal(DICT.EN['hud.alert.card.body'], undefined);
});
