import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const foods = JSON.parse(
  readFileSync(new URL('../../server/src/modules/meals/foods-final.json', import.meta.url), 'utf8'),
);
const references = JSON.parse(
  readFileSync(
    new URL('../../server/src/modules/meals/serving-references.json', import.meta.url),
    'utf8',
  ),
);
const version = createHash('sha256')
  .update(JSON.stringify([foods, references]))
  .digest('hex');
const catalog = foods.map((food) => {
  const reference = references[food.id];
  return reference && food.basis === '100g'
    ? {
        ...food,
        kcalPerPortion: Math.round(food.kcal * reference.grams) / 100,
        servingSourceUrl: reference.sourceUrl,
      }
    : food;
});
const directory = new URL('../public/food-catalog/', import.meta.url);
mkdirSync(directory, { recursive: true });
writeFileSync(new URL('foods-final.json', directory), JSON.stringify({ version, foods: catalog }));
