import data from "@/curriculum/examples/current-units.json";
import { loadCurriculum } from "./loader";

/** Validated sample curriculum for local development and demos. */
export const SAMPLE_CURRICULUM = loadCurriculum(data);
