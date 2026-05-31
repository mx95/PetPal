const test = require("node:test");
const assert = require("node:assert/strict");
const { parseG365LbsCellsFromHex } = require("../src/geo/g365Lbs");

test("g365 LBS — parse 4G cells from real device hex", () => {
  const towers = parseG365LbsCellsFromHex(
    "0301180A0000015507B89829720000015507B89829720000015507B898297200",
    0x1b
  );
  assert.ok(towers);
  assert.equal(towers.mcc, 280);
  assert.equal(towers.mnc, 10);
  assert.equal(towers.cells.length, 3);
  assert.equal(towers.cells[0].lac, 0x155);
  assert.equal(towers.cells[0].cellId, 0x07b89829);
});
