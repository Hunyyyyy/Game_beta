import quality from '../data/quality.json';

export type QualityLevel = 'high' | 'balanced' | 'saver';
/** What the player chose: one of the levels, or "auto" (the level that suits the device: quality.json). */
export type QualitySetting = 'auto' | QualityLevel;
export interface QualityDef { name: string; note: string; dprCap: number; fps: number; idleFps: number; simBudgetMs: number; fastBudgetMs: number }

export const QUALITY_SETTINGS: readonly QualitySetting[] = ['auto', 'high', 'balanced', 'saver'];
export const QUALITY_LEVELS = quality.levels as Record<QualityLevel, QualityDef>;

/** Is this a phone or a tablet (a touch screen is the main way to point)? */
export const isTouchDevice = (): boolean => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } };

/** The level a setting means on this device. */
export function levelOf(setting: QualitySetting, touch = isTouchDevice()): QualityLevel {
  return setting === 'auto' ? (quality.auto[touch ? 'touch' : 'other'] as QualityLevel) : setting;
}
