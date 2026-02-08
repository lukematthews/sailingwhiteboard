import { uid } from "../lib/ids";
import { Mark, StartLine } from "../types";

export const DEFAULT_MARKS:Mark[] = [
  { id: uid(), name: "Top mark", type: "round", x: 350, y: 50 },
];

export const DEFAULT_START_LINE: StartLine = {
    committee: { x: 600, y: 400 },
    pin: { x: 100, y: 400 },
    startBoatId: null,
  };