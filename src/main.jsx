import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import { calculateInventory } from "./inventory.js";

const BUILDINGS = Array.from({ length: 8 }, (_, i) => `B${i + 1}`);
const ROOMS = Array.from({ length: 5 }, (_, floor) =>
  Array.from({ length: 16 }, (_, room) => `${floor + 1}${String(room + 1).padStart(2, "0")}`)
).flat();
const STORAGE_KEY = "ktx-key-records-v2";

const emptyPerson = { name: "", studentId: "", phone: "" };
const emptyForm = {
  building: "B1",
  room: "101",
  action: "NHẬN",
  quantity: 1,
  sender: { ...emptyPerson },
  receiver: { ...emptyPerson },
  note: "",
};

function readRecords() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function App() {
  const [records, setRecords] = useState(readRecords);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState("");
  const [building, setBuilding] = useState("Tất cả");
  const [message, setMessage] = useState("");

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(records)), [records]);

  const inventory = useMemo(() => calculateInventory(records), [records]);

  const available = inventory.get(`${form.building}-${form.room}`) || 0;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return records.filter((record) => {
      const matchesBuilding = building === "Tất cả" || record.building === building;
      const text = `${record.building} ${record.room} ${record.sender?.name || ""} ${record.sender?.studentId || ""} ${record.sender?.phone || ""} ${record.receiver?.name || ""} ${record.receiver?.studentId || ""} ${record.receiver?.phone || ""}`.toLowerCase();
      return matchesBuilding && (!term || text.includes(term));
    });
  }, [records, query, building]);

  function updatePerson(role, field, value) {
    setForm((old) => ({ ...old, [role]: { ...old[role], [field]: value } }));
  }

  function submit(event) {
    event.preventDefault();
    const quantity = Number(form.quantity);
    if (form.action === "GIAO" && quantity > available) {
      setMessage(`Phòng ${form.building}-${form.room} chỉ còn ${available} chìa, không thể giao ${quantity}`);
      return;
    }
    const record = {
      ...form,
      quantity,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setRecords((old) => [record, ...old]);
    setForm((old) => ({ ...emptyForm, building: old.building, room: old.room, action: old.action }));
    setMessage(`Đã lưu phiếu ${form.action === "GIAO" ? "giao" : "nhận"} chìa ${form.building}-${form.room}`);
    setTimeout(() => setMessage(""), 3000);
  }

  function exportExcel() {
    const safe = (value) => {
      const text = String(value ?? "");
      const protectedText = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${protectedText.replaceAll('"', '""')}"`;
    };
    const rows = records.map((record) => {
      const student = record.action === "NHẬN" ? record.sender : record.receiver;
      return [
        new Date(record.createdAt).toLocaleString("vi-VN"), record.action === "NHẬN" ? "Nhận từ sinh viên" : "Giao cho sinh viên",
        record.building, record.room, Number(record.quantity) || 1, student?.name, student?.studentId, student?.phone, record.note,
      ];
    });
    const headings = ["Thời gian", "Loại phiếu", "Tòa", "Phòng", "Số chìa", "Họ tên sinh viên", "MSSV", "Số điện thoại", "Ghi chú"];
    const csv = [headings, ...rows].map((row) => row.map(safe).join(";")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `giao-nhan-chia-khoa-ktx-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const totalAvailable = [...inventory.values()].reduce((sum, quantity) => sum + quantity, 0);
  const totalDelivered = records.reduce((sum, record) => sum + (record.action === "GIAO" ? Number(record.quantity) || 1 : 0), 0);
  const totalKeys = totalAvailable + totalDelivered;

  return (
    <div className="app-shell">
      <header>
        <div className="brand-mark">K</div>
        <div>
          <h1>Giao nhận chìa khóa</h1>
          <p>KTX B · Đại học Cần Thơ</p>
        </div>
        <div className="header-actions">
          <button className="button secondary" onClick={exportExcel}>Xuất Excel</button>
        </div>
      </header>

      <main>
        <section className="intro">
          <div>
            <span className="eyebrow">KÝ TÚC XÁ B · ĐẠI HỌC CẦN THƠ</span>
            <h2>Sổ giao nhận<br /><em>chìa khóa KTX.</em></h2>
            <p>Ghi nhận người giao, người nhận và lịch sử bàn giao chìa khóa.</p>
          </div>
          <div className="stats">
            <div><strong>{totalAvailable}</strong><span>Số chìa khóa nhận</span></div>
            <div><strong>{totalDelivered}</strong><span>Số chìa khóa giao</span></div>
            <div><strong>{totalKeys}</strong><span>Số chìa khóa tổng cộng</span></div>
          </div>
        </section>

        <div className="workspace">
          <section className="panel form-panel">
            <div className="panel-heading">
              <div><span className="step">01</span><h3>Tạo phiếu giao nhận</h3></div>
              <span className={`status ${available ? "in" : "out"}`}>
                Còn {available} chìa
              </span>
            </div>
            <form onSubmit={submit}>
              <div className="action-switch">
                <button type="button" className={form.action === "NHẬN" ? "active" : ""} onClick={() => setForm({ ...form, action: "NHẬN" })}>Nhận chìa từ SV</button>
                <button type="button" className={form.action === "GIAO" ? "active" : ""} onClick={() => setForm({ ...form, action: "GIAO", quantity: 1 })}>Giao chìa cho SV</button>
              </div>
              <div className="field-row key-fields">
                <label>Tòa<select value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })}>{BUILDINGS.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>Phòng<select value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })}>{ROOMS.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>Số chìa<input required type="number" inputMode="numeric" min="1" max={form.action === "GIAO" ? Math.max(1, available) : 99} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
              </div>
              <PersonFields title={form.action === "NHẬN" ? "Sinh viên giao chìa" : "Sinh viên nhận chìa"} role={form.action === "NHẬN" ? "sender" : "receiver"} person={form.action === "NHẬN" ? form.sender : form.receiver} onChange={updatePerson} />
              <label>Ghi chú (không bắt buộc)<textarea rows="2" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Tình trạng chìa khóa..." /></label>
              <button className="button primary" type="submit" disabled={form.action === "GIAO" && available === 0}>{form.action === "GIAO" && available === 0 ? "Không có chìa để giao" : "Lưu phiếu giao nhận"} <span>→</span></button>
            </form>
          </section>

          <section className="panel history-panel">
            <div className="panel-heading"><div><span className="step">02</span><h3>Lịch sử gần đây</h3></div><span className="count">{filtered.length} phiếu</span></div>
            <div className="filters">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tên, MSSV, SĐT, phòng..." />
              <select value={building} onChange={(e) => setBuilding(e.target.value)}><option>Tất cả</option>{BUILDINGS.map((item) => <option key={item}>{item}</option>)}</select>
            </div>
            <div className="records">
              {filtered.length === 0 ? <div className="empty"><span>⌁</span><h4>Chưa có phiếu giao nhận</h4><p>Phiếu mới sẽ xuất hiện tại đây.</p></div> : filtered.map((record) => <Record key={record.id} record={record} />)}
            </div>
          </section>
        </div>
      </main>
      {message && <div className="toast" role="status">✓ {message}</div>}
      <footer>Dữ liệu được lưu trên thiết bị này · Hãy xuất Excel định kỳ để sao lưu</footer>
    </div>
  );
}

function PersonFields({ title, role, person, onChange }) {
  return <fieldset>
    <legend>{title}</legend>
    <label className="wide">Họ và tên<input required value={person.name} onChange={(e) => onChange(role, "name", e.target.value)} placeholder="Nguyễn Văn A" /></label>
    <label>MSSV<input required value={person.studentId} onChange={(e) => onChange(role, "studentId", e.target.value)} placeholder="22D..." /></label>
    <label>Số điện thoại<input required type="tel" pattern="[0-9 +.-]{8,15}" value={person.phone} onChange={(e) => onChange(role, "phone", e.target.value)} placeholder="09xx xxx xxx" /></label>
  </fieldset>;
}

function Record({ record }) {
  const student = record.action === "NHẬN" ? record.sender : record.receiver;
  return <article className="record">
    <div className={`record-icon ${record.action.toLowerCase()}`}>{record.action === "GIAO" ? "↗" : "↙"}</div>
    <div className="record-main">
      <div><strong>{record.building} · {record.room}</strong><span className={`pill ${record.action.toLowerCase()}`}>{record.action === "GIAO" ? "Giao cho SV" : "Nhận từ SV"}</span><span className="quantity">{record.action === "GIAO" ? "−" : "+"}{Number(record.quantity) || 1} chìa</span></div>
      <p><b>{student?.name || "Không có tên"}</b></p>
      <small>{new Date(record.createdAt).toLocaleString("vi-VN")} · MSSV {student?.studentId || "—"} · {student?.phone || "—"}</small>
      {record.note && <small className="note">“{record.note}”</small>}
    </div>
  </article>;
}

createRoot(document.getElementById("root")).render(<App />);
