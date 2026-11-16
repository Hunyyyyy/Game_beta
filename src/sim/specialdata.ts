/** The specialist soldiers (data/specialists.json `units`) with no Sim: who they are, what they wear, what they are worth (data layer). The system that trains them is barracks.ts. */
import SPEC from '../data/specialists.json';
import type { StatId } from './research';
import type { RankRole } from './ranks';
import { buildingName, type BuildingKind } from './buildings';

export interface SpecialistDef {
  id: string; key: string; name: string; camp: RankRole; weapon: string; armor: string; mount?: string;
  profile: Partial<Record<StatId, number>>; costMult: number; rationAdd: number; about: string;
  hire?: boolean; stealth?: boolean; ambush?: number; siege?: number;
}
export const SPECIALISTS = SPEC.units as unknown as SpecialistDef[];
/** The specialist buildings (data/specialists.json `buildings`): locked until the legacy opens them (isUnlocked('building:<kind>')). */
export const SPECIAL_BUILDINGS: string[] = (SPEC.buildings as Array<{ id: string }>).map((b) => b.id);
export const specialBuilding = (kind: string): boolean => SPECIAL_BUILDINGS.includes(kind);
export const specialistDef = (id: string | undefined): SpecialistDef | undefined => (id ? SPECIALISTS.find((s) => s.id === id) : undefined);
export const specialistsOf = (camp: string): SpecialistDef[] => SPECIALISTS.filter((s) => s.camp === camp);
/** What a specialist does to a stat on top of his rank (1 for a stat his profile leaves alone). */
export const specStat = (id: string | undefined, stat: StatId): number => specialistDef(id)?.profile[stat] ?? 1;
export const specRation = (id: string | undefined): number => specialistDef(id)?.rationAdd ?? 0;
export const specSiege = (id: string | undefined): number => specialistDef(id)?.siege ?? 1;
/** The name of a specialist by its key of unlocks.json (`unit:<id>`, `building:<kind>`). */
export const unlockName = (key: string): string => { const [kind, id] = key.split(':'); return kind === 'unit' ? specialistDef(id)?.name ?? id : kind === 'building' ? buildingName(id as BuildingKind, 'ancient') : id; };
