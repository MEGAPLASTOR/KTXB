import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, Building2, Download, FileKey, History, Home as HomeIcon, KeyRound, LogOut, Menu, Pencil, Plus, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { calculateInventory } from "./inventory.js";
import "./style.css";

const BUILDINGS = Array.from({ length: 8 }, (_, i) => `B${i + 1}`);
const ROOMS = Array.from({ length: 5 }, (_, floor) =>
  Array.from({ length: 16 }, (_, room) => `${floor + 1}${String(room + 1).padStart(2, "0")}`)
).flat();
const STORAGE_KEY = "ktx-key-records-v3";
const emptyPerson = { name: "", studentId: "", phone: "" };

function newForm(action = "NHẬN") {
  return { building: "B1", room: "101", action, quantity: 1, sender: { ...emptyPerson }, receiver: { ...emptyPerson }, note: "" };
}

function readRecords() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function exportExcel(records) {
  const safe = (value) => {
    const text = String(value ?? "");
    const protectedText = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${protectedText.replaceAll('"', '""')}"`;
  };
  const headings = ["Thời gian", "Loại phiếu", "Tòa", "Phòng", "Số chìa", "Họ tên sinh viên", "MSSV", "Số điện thoại", "Ghi chú"];
  const rows = records.map((record) => {
    const student = record.action === "NHẬN" ? record.sender : record.receiver;
    return [new Date(record.createdAt).toLocaleString("vi-VN"), record.action === "NHẬN" ? "Nhận từ sinh viên" : "Giao cho sinh viên", record.building, record.room, Number(record.quantity) || 1, student?.name, student?.studentId, student?.phone, record.note];
  });
  const csv = [headings, ...rows].map((row) => row.map(safe).join(";")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  link.download = `giao-nhan-chia-khoa-ktx-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function App() {
  const [records, setRecords] = useState(readRecords);
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(records)), [records]);
  return location.pathname.toLowerCase() === "/ktxmyadmin"
    ? <Admin records={records} setRecords={setRecords} />
    : <Home records={records} setRecords={setRecords} />;
}

function Home({ records, setRecords }) {
  const [action, setAction] = useState(null);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [building, setBuilding] = useState("Tất cả");
  const inventory = useMemo(() => calculateInventory(records), [records]);
  const available = [...inventory.values()].reduce((sum, value) => sum + value, 0);
  const delivered = records.reduce((sum, record) => sum + (record.action === "GIAO" ? Number(record.quantity) || 1 : 0), 0);
  const filtered = useMemo(() => records.filter((record) => {
    const student = record.action === "NHẬN" ? record.sender : record.receiver;
    const text = `${record.building} ${record.room} ${student?.name || ""} ${student?.studentId || ""} ${student?.phone || ""}`.toLowerCase();
    return (building === "Tất cả" || record.building === building) && text.includes(query.trim().toLowerCase());
  }), [records, query, building]);

  function save(record) {
    setRecords((old) => [{ ...record, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...old]);
    setAction(null);
    setMessage(`Đã lưu phiếu ${record.action === "NHẬN" ? "nhận" : "giao"} chìa ${record.building}-${record.room}`);
    setTimeout(() => setMessage(""), 3000);
  }

  return <div className="app-shell">
    <TopBar />
    <main className="home-main">
      <section className="hero">
        <span className="eyebrow">KTX B · ĐẠI HỌC CẦN THƠ</span>
        <h2>Giao nhận chìa khóa<br /><em>nhanh và rõ ràng.</em></h2>
        <p>Chọn thao tác bên dưới để bắt đầu.</p>
      </section>

      <section className="quick-actions" aria-label="Thao tác giao nhận">
        <button className="action-card receive" onClick={() => setAction("NHẬN")}>
          <span className="action-icon"><ArrowDownToLine /></span><span><small>SINH VIÊN TRẢ CHÌA</small><strong>Nhận chìa</strong><em>Cộng chìa vào quầy</em></span><ArrowRight className="action-arrow" />
        </button>
        <button className="action-card deliver" onClick={() => setAction("GIAO")} disabled={!available}>
          <span className="action-icon"><ArrowUpFromLine /></span><span><small>TRẢ CHÌA CHO SINH VIÊN</small><strong>Giao chìa</strong><em>{available ? "Trừ chìa khỏi quầy" : "Hiện chưa có chìa để giao"}</em></span><ArrowRight className="action-arrow" />
        </button>
      </section>

      <section className="metric-grid">
        <Metric icon={<ArrowDownToLine />} value={available} label="Chìa đang nhận" tone="green" />
        <Metric icon={<ArrowUpFromLine />} value={delivered} label="Chìa đã giao" tone="amber" />
        <Metric icon={<KeyRound />} value={available + delivered} label="Tổng số chìa" tone="blue" />
      </section>

      <section className="recent-card">
        <div className="section-title"><div><span>HOẠT ĐỘNG MỚI</span><h3>Lịch sử giao nhận</h3></div><small>{filtered.length} phiếu</small></div>
        <div className="user-filters">
          <div className="search-field"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tên, MSSV, SĐT, phòng..." aria-label="Tìm phiếu giao nhận" /></div>
          <select value={building} onChange={(e) => setBuilding(e.target.value)} aria-label="Lọc theo tòa"><option>Tất cả</option>{BUILDINGS.map((item) => <option key={item}>{item}</option>)}</select>
        </div>
        {filtered.length ? filtered.map((record) => <RecordCard key={record.id} record={record} />) : <Empty />}
      </section>
    </main>
    <footer>Dữ liệu lưu trên thiết bị này · KTX B Đại học Cần Thơ</footer>
    {action && <KeyModal action={action} inventory={inventory} onClose={() => setAction(null)} onSave={save} />}
    {message && <div className="toast" role="status">✓ {message}</div>}
  </div>;
}

function TopBar({ admin = false, onLogout, onMenu }) {
  return <header>
    <a className="brand" href="/" aria-label="Trang chủ"><span className="brand-mark">K</span><span><strong>{admin ? "Quản trị chìa khóa" : "Giao nhận chìa khóa"}</strong><small>KTX B · Đại học Cần Thơ</small></span></a>
    {admin && <div className="top-actions"><button className="menu-button" onClick={onMenu} aria-label="Mở menu"><Menu /></button><button className="header-button" onClick={onLogout}><LogOut /> Đăng xuất</button></div>}
  </header>;
}

function Metric({ icon, value, label, tone }) {
  return <div className={`metric ${tone}`}><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>;
}

function KeyModal({ action, inventory, initial, onClose, onSave }) {
  const [form, setForm] = useState(initial ? structuredClone(initial) : newForm(action));
  const [error, setError] = useState("");
  const available = inventory.get(`${form.building}-${form.room}`) || 0;
  const role = form.action === "NHẬN" ? "sender" : "receiver";
  const student = form[role];

  function submit(event) {
    event.preventDefault();
    const quantity = Number(form.quantity);
    if (form.action === "GIAO" && quantity > available && !initial) return setError(`Phòng này chỉ còn ${available} chìa.`);
    onSave({ ...form, quantity });
  }

  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section className="key-modal" role="dialog" aria-modal="true" aria-label={`Phiếu ${action === "NHẬN" ? "nhận" : "giao"} chìa`}>
      <div className="modal-handle" />
      <div className="modal-head"><div className={`modal-icon ${form.action === "NHẬN" ? "receive" : "deliver"}`}>{form.action === "NHẬN" ? <ArrowDownToLine /> : <ArrowUpFromLine />}</div><div><small>PHIẾU GIAO NHẬN</small><h3>{form.action === "NHẬN" ? "Nhận chìa từ sinh viên" : "Giao chìa cho sinh viên"}</h3></div><button className="close" type="button" onClick={onClose} aria-label="Đóng"><X /></button></div>
      <form onSubmit={submit}>
        <div className="form-mode">
          <button type="button" className={form.action === "NHẬN" ? "active receive" : ""} onClick={() => setForm({ ...form, action: "NHẬN", sender: student })}>Nhận chìa</button>
          <button type="button" className={form.action === "GIAO" ? "active deliver" : ""} onClick={() => setForm({ ...form, action: "GIAO", receiver: student, quantity: 1 })}>Giao chìa</button>
        </div>
        <div className="location-fields">
          <label>Tòa<select value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })}>{BUILDINGS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Phòng<select value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })}>{ROOMS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Số chìa<input required type="number" inputMode="numeric" min="1" max="99" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
        </div>
        <div className="stock-line"><span>Phòng {form.building}-{form.room}</span><strong>Còn {available} chìa tại quầy</strong></div>
        <fieldset>
          <legend>Thông tin sinh viên</legend>
          <label className="wide">Họ và tên<input required autoFocus value={student.name} onChange={(e) => setForm({ ...form, [role]: { ...student, name: e.target.value } })} placeholder="Nguyễn Văn A" /></label>
          <label>MSSV<input required value={student.studentId} onChange={(e) => setForm({ ...form, [role]: { ...student, studentId: e.target.value } })} placeholder="B2200000" /></label>
          <label>Số điện thoại<input required type="tel" pattern="[0-9 +.-]{8,15}" value={student.phone} onChange={(e) => setForm({ ...form, [role]: { ...student, phone: e.target.value } })} placeholder="09xx xxx xxx" /></label>
        </fieldset>
        <label>Ghi chú <span className="optional">Không bắt buộc</span><textarea rows="2" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Tình trạng chìa khóa..." /></label>
        {error && <p className="form-error">{error}</p>}
        <button className={`submit-button ${form.action === "NHẬN" ? "receive" : "deliver"}`} type="submit">Xác nhận {form.action === "NHẬN" ? "nhận" : "giao"} chìa <span>→</span></button>
      </form>
    </section>
  </div>;
}

function RecordCard({ record, actions }) {
  const student = record.action === "NHẬN" ? record.sender : record.receiver;
  return <article className="record">
    <div className={`record-icon ${record.action === "NHẬN" ? "receive" : "deliver"}`}>{record.action === "NHẬN" ? <ArrowDownToLine /> : <ArrowUpFromLine />}</div>
    <div className="record-main"><div><strong>{record.building} · {record.room}</strong><span className={`pill ${record.action === "NHẬN" ? "receive" : "deliver"}`}>{record.action === "NHẬN" ? "Nhận từ SV" : "Giao cho SV"}</span><span className="quantity">{record.action === "NHẬN" ? "+" : "−"}{Number(record.quantity) || 1}</span></div><p>{student?.name || "Không có tên"} · {student?.studentId || "—"}</p><small>{new Date(record.createdAt).toLocaleString("vi-VN")} · {student?.phone || "—"}</small></div>
    {actions && <div className="record-actions">{actions}</div>}
  </article>;
}

function Empty() { return <div className="empty"><span><FileKey /></span><h4>Chưa có phiếu giao nhận</h4><p>Hoạt động mới sẽ xuất hiện tại đây.</p></div>; }

function Admin({ records, setRecords }) {
  const [loggedIn, setLoggedIn] = useState(sessionStorage.getItem("ktx-admin") === "yes");
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const inventory = useMemo(() => calculateInventory(records), [records]);

  if (!loggedIn) return <AdminLogin onLogin={() => { sessionStorage.setItem("ktx-admin", "yes"); setLoggedIn(true); }} />;
  const filtered = records.filter((record) => {
    const student = record.action === "NHẬN" ? record.sender : record.receiver;
    return `${record.building} ${record.room} ${student?.name} ${student?.studentId} ${student?.phone}`.toLowerCase().includes(query.toLowerCase());
  });
  const available = [...inventory.values()].reduce((sum, value) => sum + value, 0);

  function remove(id) { setRecords((old) => old.filter((item) => item.id !== id)); setConfirmAction(null); }
  function clearAll() { setRecords([]); setConfirmAction(null); }
  function saveEdit(record) { setRecords((old) => old.map((item) => item.id === editing.id ? { ...record, id: item.id, createdAt: item.createdAt } : item)); setEditing(null); }
  function add(record) { setRecords((old) => [{ ...record, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...old]); setAdding(false); }

  return <div className="admin-shell">
    <TopBar admin onMenu={() => setMenuOpen(true)} onLogout={() => { sessionStorage.removeItem("ktx-admin"); setLoggedIn(false); }} />
    <aside className={`admin-sidebar ${menuOpen ? "open" : ""}`}>
      <div className="sidebar-brand"><span className="brand-mark">K</span><div><strong>KTX Key</strong><small>Admin workspace</small></div><button onClick={() => setMenuOpen(false)} aria-label="Đóng menu"><X /></button></div>
      <nav><a className="active" href="#overview"><HomeIcon /> Tổng quan</a><a href="#records"><History /> Phiếu giao nhận</a><a href="/"><KeyRound /> Trang người dùng</a></nav>
      <div className="sidebar-account"><ShieldCheck /><div><strong>Quản trị viên</strong><small>admin</small></div></div>
    </aside>
    {menuOpen && <button className="sidebar-scrim" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />}
    <main className="admin-main" id="overview">
      <div className="admin-heading"><div><span className="eyebrow">TRANG QUẢN TRỊ</span><h2>Quản lý giao nhận</h2><p>Kiểm tra và điều chỉnh toàn bộ dữ liệu chìa khóa.</p></div><button className="add-button" onClick={() => setAdding(true)}><Plus /> Thêm phiếu</button></div>
      <section className="admin-metrics"><Metric value={available} label="Chìa tại quầy" tone="green" icon={<KeyRound />} /><Metric value={records.length} label="Tổng phiếu" tone="blue" icon={<FileKey />} /><Metric value={new Set(records.map((r) => `${r.building}-${r.room}`)).size} label="Phòng có dữ liệu" tone="amber" icon={<Building2 />} /></section>
      <section className="admin-panel" id="records">
        <div className="admin-panel-title"><div><h3>Phiếu giao nhận</h3><p>{filtered.length} kết quả trong hệ thống</p></div></div>
        <div className="admin-tools"><div className="search-field"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tên, MSSV, SĐT, phòng..." /></div><div><button onClick={() => exportExcel(records)}><Download /> Xuất Excel</button><button className="danger-outline" onClick={() => setConfirmAction({ type: "all" })}><Trash2 /> Xóa sạch</button></div></div>
        <div className="admin-list">{filtered.length ? filtered.map((record) => <RecordCard key={record.id} record={record} actions={<><button onClick={() => setEditing(record)} aria-label="Sửa phiếu"><Pencil /> <span>Sửa</span></button><button className="delete" onClick={() => setConfirmAction({ type: "one", id: record.id })} aria-label="Xóa phiếu"><Trash2 /> <span>Xóa</span></button></>} />) : <Empty />}</div>
      </section>
    </main>
    {(adding || editing) && <KeyModal action={editing?.action || "NHẬN"} initial={editing} inventory={inventory} onClose={() => { setAdding(false); setEditing(null); }} onSave={editing ? saveEdit : add} />}
    {confirmAction && <ConfirmDialog all={confirmAction.type === "all"} onCancel={() => setConfirmAction(null)} onConfirm={() => confirmAction.type === "all" ? clearAll() : remove(confirmAction.id)} />}
  </div>;
}

function ConfirmDialog({ all, onCancel, onConfirm }) {
  return <div className="modal-backdrop confirm-backdrop"><section className="confirm-dialog" role="alertdialog" aria-modal="true"><span><Trash2 /></span><h3>{all ? "Xóa sạch dữ liệu?" : "Xóa phiếu này?"}</h3><p>{all ? "Toàn bộ lịch sử và số lượng chìa sẽ bị xóa vĩnh viễn." : "Phiếu giao nhận này sẽ bị xóa và tồn kho được tính lại."}</p><div><button onClick={onCancel}>Hủy</button><button className="danger-button" onClick={onConfirm}>Xác nhận xóa</button></div></section></div>;
}

function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  function submit(event) { event.preventDefault(); if (username === "admin" && password === "admin") onLogin(); else setError("Tài khoản hoặc mật khẩu không đúng."); }
  return <main className="login-page"><section className="login-card"><div className="login-logo">K</div><span className="eyebrow">KTX B · ĐẠI HỌC CẦN THƠ</span><h1>Đăng nhập quản trị</h1><p>Quản lý dữ liệu giao nhận chìa khóa</p><form onSubmit={submit}><label>Tài khoản<input autoFocus required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nhập tài khoản" /></label><label>Mật khẩu<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nhập mật khẩu" /></label>{error && <p className="form-error">{error}</p>}<button className="submit-button receive">Đăng nhập <span>→</span></button></form><a href="/">← Về trang giao nhận</a></section></main>;
}

createRoot(document.getElementById("root")).render(<App />);
