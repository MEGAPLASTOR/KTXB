export function calculateInventory(records) {
  const inventory = new Map();
  [...records].reverse().forEach((record) => {
    const key = `${record.building}-${record.room}`;
    const quantity = Number(record.quantity) || 1;
    const movement = record.action === "NHẬN" ? quantity : record.action === "MƯỢN" ? -(quantity - (Number(record.returnedQuantity) || 0)) : -quantity;
    inventory.set(key, Math.max(0, (inventory.get(key) || 0) + movement));
  });
  return inventory;
}
