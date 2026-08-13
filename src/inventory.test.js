import assert from "node:assert/strict";
import { calculateInventory } from "./inventory.js";

const records = [
  { building: "B1", room: "101", action: "GIAO", quantity: 2 },
  { building: "B1", room: "101", action: "NHẬN", quantity: 2 },
];
assert.equal(calculateInventory(records).get("B1-101"), 0);
