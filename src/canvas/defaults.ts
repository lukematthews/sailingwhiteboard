import { uid } from "../lib/ids";
import { Mark, StartLine } from "../types";

export const DEFAULT_MARKS: Mark[] = [
  { id: uid(), name: "Top mark", type: "round", x: 350, y: 50 },
];

export const DEFAULT_START_LINE: StartLine = {
  committee: { x: 600, y: 400 },
  pin: { x: 100, y: 400 },
  startBoatId: null,
};

export const DEFAULT_BOATS = [
  {
    id: uid(),
    label: "Blue",
    color: "#3b82f6",
    x: 100,
    y: 170,
    headingDeg: 20,
  },
  {
    id: uid(),
    label: "Yellow",
    color: "#f59e0b",
    x: 600,
    y: 170,
    headingDeg: 200,
  },
];
