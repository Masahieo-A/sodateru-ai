import {
  CURRICULUM_ID,
  CURRICULUM_VERSION,
  UNIT_CATALOG,
  type UnitCatalogEntry,
} from "@/curriculum/generated/unit-catalog";

/** Small client-safe catalog; question banks stay server/runtime data. */
export { CURRICULUM_ID, CURRICULUM_VERSION, UNIT_CATALOG };
export type { UnitCatalogEntry };
