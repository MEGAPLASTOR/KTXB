export function calculateInventory(records) {
  const inventory = new Map();
  [...records].reverse().forEach((record) => {
    const key = `${record.building}-${record.room}`;
    const quantity = Number(record.quantity) || 1;
    inventory.set(key, Math.max(0, (inventory.get(key) || 0) + (record.action === "NHẬN" ? quantity : -quantity)));
  });
  return inventory;
}
