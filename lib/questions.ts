import type { GrammarUnit } from "@/types";
import runtime from "@/curriculum/generated/g24-runtime.json";
import { loadCurriculum, toGrammarUnit } from "@/lib/curriculum/loader";

/** Runtime projection of the published G24 curriculum. */
const curriculum = loadCurriculum(runtime);

export const GRAMMAR_UNITS: GrammarUnit[] = curriculum.units
  .map((unit) => toGrammarUnit(curriculum, unit.id))
  .filter((unit): unit is GrammarUnit => Boolean(unit));

export function getUnitById(id: string): GrammarUnit | undefined {
  return GRAMMAR_UNITS.find((unit) => unit.id === id);
}
