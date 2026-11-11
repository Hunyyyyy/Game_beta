/** The processing houses of the medieval age (Lò luyện, Xưởng mộc, Xưởng thuộc da và dệt): their recipes, from src/data/processing.json. Pure data. */
import data from '../data/processing.json';
import type { Stock } from './resources';

export interface ProcessRecipe { id: string; name: string; in: Partial<Stock>; out: Partial<Stock>; time: number; level: number }
export const PROCESS_HOUSES = data.houses as unknown as Record<string, ProcessRecipe[]>;
export const MAX_QUEUE = data.maxQueue;
/** What the village is given once, when it steps into the medieval age, so that nobody is stuck before the mines. */
export const START_KIT = data.startKit as Partial<Stock>;
export const isProcessKind = (kind: string): boolean => kind in PROCESS_HOUSES;
export const processRecipe = (kind: string, id: string): ProcessRecipe | undefined => PROCESS_HOUSES[kind]?.find((r) => r.id === id);
