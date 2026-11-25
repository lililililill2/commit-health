import { createHash } from 'node:crypto';

import foods from './foods-final.json' with { type: 'json' };
import references from './serving-references.json' with { type: 'json' };

export const catalogVersion = createHash('sha256')
  .update(JSON.stringify([foods, references]))
  .digest('hex');
export const catalogById = new Map(foods.map((food) => [food.id, food]));
export const servingById = new Map(Object.entries(references));
