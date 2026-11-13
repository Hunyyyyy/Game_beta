/** The goods a Trại chăn nuôi makes, from src/data/ranch.json, and the level of the house that opens each. Pure data. */
import data from '../data/ranch.json';
import type { Res } from './resources';

export interface RanchProduct { res: Res; per: number; time: number; level: number }
export const RANCH_PRODUCTS = data.products as unknown as RanchProduct[];
/** The products a ranch of this level makes. */
export const productsAt = (level: number): RanchProduct[] => RANCH_PRODUCTS.filter((p) => p.level <= level);
