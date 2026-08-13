import assert from "node:assert/strict";
import { calculateInventory } from "./inventory.js";

const records = [
  { building: "B1", room: "101", action: "MƯỢN", quantity: 1, returnedQuantity: 1 },
  { building: "B1", room: "101", action: "GIAO", quantity: 2 },
  { building: "B1", room: "101", action: "NHẬN", quantity: 2 },
];
assert.equal(calculateInventory(records).get("B1-101"), 0);

const borrowedKey = [
  { building: "B2", room: "202", action: "MƯỢN", quantity: 1 },
  { building: "B2", room: "202", action: "NHẬN", quantity: 1 },
];
assert.equal(calculateInventory(borrowedKey).get("B2-202"), 0);
assert.equal(calculateInventory([{ ...borrowedKey[0], returnedQuantity: 1 }, borrowedKey[1]]).get("B2-202"), 1);
