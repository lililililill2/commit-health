import assert from 'node:assert/strict';
import test from 'node:test';

import { searchFoods, searchFoodTerms } from './catalog-search.ts';

test('ranks exact, prefix and substring matches despite spacing differences', () => {
  const foods = [
    { name: '돼지김치찌개' },
    { name: '김치찌개 정식' },
    { name: '김치 찌개' },
    { name: '된장찌개' },
  ];
  assert.deepEqual(searchFoods(foods, '김치 찌개'), [foods[2], foods[1], foods[0]]);
  assert.deepEqual(searchFoods(foods, '김치찌개', 1), [foods[2]]);
  assert.deepEqual(searchFoods(foods, '  '), []);
});

test('searches comma-separated entries independently and skips duplicate or blank terms', () => {
  const foods = [{ name: '김밥' }, { name: '참치김밥' }, { name: '김치찌개' }];
  const groups = searchFoodTerms(foods, ' 김밥, 김치 찌개，，김 밥, 없는 음식, ');
  assert.deepEqual(
    groups.map(({ key, matches }) => [key, matches.map((food) => food.name)]),
    [
      ['김밥', ['김밥', '참치김밥']],
      ['김치찌개', ['김치찌개']],
      ['없는음식', []],
    ],
  );
});
