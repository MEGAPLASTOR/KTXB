import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, Building2, Copy, Download, FileKey, History, Home as HomeIcon, KeyRound, LogOut, Menu, Pencil, Plus, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { calculateInventory } from "./inventory.js";
import { firebaseConfigured, saveRecords, subscribeRecords } from "./firebase.js";
import "./style.css";

const BUILDINGS = Array.from({ length: 8 }, (_, i) => `B${i + 1}`);
const ROOMS = Array.from({ length: 5 }, (_, floor) =>
  Array.from({ length: 16 }, (_, room) => `${floor + 1}${String(room + 1).padStart(2, "0")}`)
).flat();
const emptyPerson = { name: "", studentId: "", phone: "" };
const actionName = (action) => action === "NHẬN" ? "nhận" : action === "MƯỢN" ? "mượn" : "giao";
const actionStudent = (record) => record.action === "NHẬN" ? record.sender : record.receiver;
const actionStatus = (record) => record.action === "NHẬN" ? "Đã nhận" : record.action === "GIAO" ? "Đã giao" : record.returnedAt ? "Đã trả" : "Đã mượn";

function newForm(action = "NHẬN") {
  return { building: "B1", room: "101", action, quantity: 1, sender: { ...emptyPerson }, receiver: { ...emptyPerson }, note: "" };
}

function exportExcel(records) {
  const safe = (value) => {
    const text = String(value ?? "");
    const protectedText = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${protectedText.replaceAll('"', '""')}"`;
  };
  const headings = ["Thời gian", "Loại phiếu", "Tòa", "Phòng", "Số chìa", "Họ tên sinh viên", "MSSV", "Số điện thoại", "Ghi chú"];
  const rows = records.map((record) => {
    const student = actionStudent(record);
    return [new Date(record.createdAt).toLocaleString("vi-VN"), actionStatus(record), record.building, record.room, Number(record.quantity) || 1, student?.name, student?.studentId, student?.phone, record.note];
  });
  const csv = [headings, ...rows].map((row) => row.map(safe).join(";")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  link.download = `giao-nhan-chia-khoa-ktx-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function App() {
  const [records, setRecordState] = useState([]);
  const [syncStatus, setSyncStatus] = useState("loading");
  const [connectionKey, setConnectionKey] = useState(0);
  useEffect(() => {
    let unsubscribe;
    setSyncStatus("loading");
    subscribeRecords((items) => { setRecordState(items); setSyncStatus("ready"); }, () => setSyncStatus("error"))
      .then((stop) => { unsubscribe = stop; })
      .catch(() => setSyncStatus("error"));
    return () => unsubscribe?.();
  }, [connectionKey]);
  function setRecords(update) {
    setRecordState((old) => {
      const next = typeof update === "function" ? update(old) : update;
      saveRecords(next).catch(() => setSyncStatus("error"));
      return next;
    });
  }
  if (syncStatus !== "ready") return <LoadingScreen error={syncStatus === "error" || !firebaseConfigured} onRetry={() => setConnectionKey((key) => key + 1)} />;
  return <>{location.pathname.toLowerCase() === "/ktxmyadmin"
    ? <Admin records={records} setRecords={setRecords} />
    : <Home records={records} setRecords={setRecords} />}</>;
}

function LoadingScreen({ error, onRetry }) {
  return <main className="loading-screen"><div className="loading-stars" /><section className={`loading-card ${error ? "error" : ""}`} role="status" aria-live="polite"><div className="loading-logo">CTU<span className="loading-ring" /></div>{error ? <><span className="loading-eyebrow">CHƯA THỂ ĐỒNG BỘ</span><h1>Không thể tải dữ liệu</h1><p>Vui lòng kiểm tra mạng hoặc bật Anonymous Authentication trong Firebase.</p><button onClick={onRetry}>Thử lại <ArrowRight /></button></> : <><span className="loading-eyebrow">KTX B · ĐẠI HỌC CẦN THƠ</span><h1>Đang tải dữ liệu</h1><p>Đang đồng bộ chìa khóa và phiếu giao nhận...</p><div className="loading-dots"><i /><i /><i /></div></>}</section></main>;
}

function Home({ records, setRecords }) {
  const [action, setAction] = useState(null);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [building, setBuilding] = useState("Tất cả");
  const [room, setRoom] = useState("Tất cả");
  const [detail, setDetail] = useState(null);
  const inventory = useMemo(() => calculateInventory(records), [records]);
  const available = [...inventory.values()].reduce((sum, value) => sum + value, 0);
  const delivered = records.reduce((sum, record) => sum + (record.action === "GIAO" ? Number(record.quantity) || 1 : 0), 0);
  const borrowed = records.reduce((sum, record) => sum + (record.action === "MƯỢN" && !record.returnedAt ? Number(record.quantity) || 1 : 0), 0);
  const filtered = useMemo(() => records.filter((record) => {
    const student = actionStudent(record);
    const text = `${record.building} ${record.room} ${student?.name || ""} ${student?.studentId || ""} ${student?.phone || ""}`.toLowerCase();
    return (building === "Tất cả" || record.building === building) && (room === "Tất cả" || record.room === room) && text.includes(query.trim().toLowerCase());
  }), [records, query, building, room]);

  function save(record) {
    setRecords((old) => [{ ...record, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...old]);
    setAction(null);
    setMessage(`Đã lưu phiếu ${actionName(record.action)} chìa ${record.building}-${record.room}`);
    setTimeout(() => setMessage(""), 3000);
  }
  function returnBorrowed(id) { setRecords((old) => old.map((record) => record.id === id ? { ...record, returnedAt: new Date().toISOString(), returnedQuantity: Number(record.quantity) || 1 } : record)); }

  return <div className="app-shell">
    <TopBar />
    <main className="home-main">
      <section className="hero">
        <span className="eyebrow">KTX B · ĐẠI HỌC CẦN THƠ</span>
        <h2>Quản lý chìa khóa<br /><em>Ký túc xá B.</em></h2>
        <p>Hệ thống giao nhận chìa khóa cho tân sinh viên KTX B.</p>
      </section>

      <section className="quick-actions" aria-label="Thao tác giao nhận">
        <button className="action-card receive" onClick={() => setAction("NHẬN")}>
          <span className="action-icon"><ArrowDownToLine /></span><span><small>SINH VIÊN GỬI CHÌA</small><strong>Nhận chìa</strong><em>Cộng chìa vào quầy</em></span><ArrowRight className="action-arrow" />
        </button>
        <button className="action-card deliver" onClick={() => setAction("GIAO")} disabled={!available}>
          <span className="action-icon"><ArrowUpFromLine /></span><span><small>GIAO CHÌA CHO SINH VIÊN</small><strong>Giao chìa</strong><em>{available ? "Trừ chìa khỏi quầy" : "Hiện chưa có chìa để giao"}</em></span><ArrowRight className="action-arrow" />
        </button>
        <button className="action-card borrow" onClick={() => setAction("MƯỢN")} disabled={!available}>
          <span className="action-icon"><KeyRound /></span><span><small>CHO SINH VIÊN MƯỢN</small><strong>Mượn chìa</strong><em>{available ? "Trừ chìa khỏi quầy" : "Hiện chưa có chìa để mượn"}</em></span><ArrowRight className="action-arrow" />
        </button>
      </section>

      <section className="metric-grid">
        <Metric icon={<KeyRound />} value={available} label="Chìa tại quầy" tone="green" />
        <Metric icon={<ArrowUpFromLine />} value={delivered} label="Chìa đã giao" tone="amber" />
        <Metric icon={<KeyRound />} value={borrowed} label="Lượt mượn chìa" tone="purple" />
        <Metric icon={<FileKey />} value={records.length} label="Tổng số phiếu" tone="blue" />
      </section>

      <section className="recent-card">
        <div className="section-title"><div><span>HOẠT ĐỘNG MỚI</span><h3>Lịch sử giao nhận</h3></div><small>{filtered.length} phiếu</small></div>
        <div className="user-filters">
          <div className="search-field"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tên, MSSV, SĐT, phòng..." aria-label="Tìm phiếu giao nhận" /></div>
          <select value={building} onChange={(e) => { setBuilding(e.target.value); setRoom("Tất cả"); }} aria-label="Lọc theo tòa"><option>Tất cả</option>{BUILDINGS.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={room} disabled={building === "Tất cả"} onChange={(e) => setRoom(e.target.value)} aria-label="Lọc theo phòng"><option value="Tất cả">{building === "Tất cả" ? "Chọn tòa trước" : "Tất cả phòng"}</option>{ROOMS.map((item) => <option key={item} value={item}>{item} · còn {inventory.get(`${building}-${item}`) || 0} chìa</option>)}</select>
        </div>
        {building !== "Tất cả" && room !== "Tất cả" && <div className="filter-stock"><KeyRound /><span>Phòng <strong>{building}-{room}</strong> hiện còn <strong>{inventory.get(`${building}-${room}`) || 0} chìa</strong> tại quầy</span></div>}
        {filtered.length ? filtered.map((record) => <RecordCard key={record.id} record={record} roomStock={inventory.get(`${record.building}-${record.room}`) || 0} onOpen={() => setDetail(record)} actions={record.action === "MƯỢN" && !record.returnedAt && <button className="return-borrowed" onClick={() => returnBorrowed(record.id)}><ArrowDownToLine /> Trả chìa đã mượn</button>} />) : <Empty />}
      </section>
    </main>
    <footer>
      <strong>Chủ website: Đinh Tấn Đạt</strong>
      <span>Có lỗi xảy ra, vui lòng liên hệ <a href="tel:0939358873">0939 358 873</a></span>
    </footer>
    {action && <KeyModal action={action} inventory={inventory} onClose={() => setAction(null)} onSave={save} />}
    {detail && <RecordDetail record={detail} roomStock={inventory.get(`${detail.building}-${detail.room}`) || 0} onClose={() => setDetail(null)} />}
    {message && <div className="toast" role="status">✓ {message}</div>}
  </div>;
}

function TopBar({ admin = false, onLogout, onMenu }) {
  return <header>
    <a className="brand" href="/" aria-label="Trang chủ"><span className="brand-mark">CTU</span><span><strong>{admin ? "Quản trị chìa khóa" : "Giao nhận chìa khóa"}</strong><small>KTX B · ĐẠI HỌC CẦN THƠ</small></span></a>
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
    if (form.action !== "NHẬN" && quantity > available && !initial) return setError(`Phòng này chỉ còn ${available} chìa.`);
    onSave({ ...form, quantity });
  }

  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section className="key-modal" role="dialog" aria-modal="true" aria-label={`Phiếu ${actionName(action)} chìa`}>
      <div className="modal-handle" />
      <div className="modal-head"><div className={`modal-icon ${form.action === "NHẬN" ? "receive" : form.action === "MƯỢN" ? "borrow" : "deliver"}`}>{form.action === "NHẬN" ? <ArrowDownToLine /> : form.action === "MƯỢN" ? <KeyRound /> : <ArrowUpFromLine />}</div><div><small>PHIẾU GIAO NHẬN</small><h3>{form.action === "NHẬN" ? "Nhận chìa từ sinh viên" : form.action === "MƯỢN" ? "Cho sinh viên mượn chìa" : "Giao chìa cho sinh viên"}</h3></div><button className="close" type="button" onClick={onClose} aria-label="Đóng"><X /></button></div>
      <form onSubmit={submit}>
        <div className="form-mode">
          <button type="button" className={form.action === "NHẬN" ? "active receive" : ""} onClick={() => setForm({ ...form, action: "NHẬN", sender: student })}>Nhận chìa</button>
          <button type="button" className={form.action === "GIAO" ? "active deliver" : ""} onClick={() => setForm({ ...form, action: "GIAO", receiver: student, quantity: 1 })}>Giao chìa</button>
          <button type="button" className={form.action === "MƯỢN" ? "active borrow" : ""} onClick={() => setForm({ ...form, action: "MƯỢN", receiver: student, quantity: 1 })}>Mượn chìa</button>
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
          <label>Số điện thoại<input required type="tel" inputMode="tel" pattern="[0-9 +.\x2d]{8,15}" value={student.phone} onChange={(e) => setForm({ ...form, [role]: { ...student, phone: e.target.value } })} placeholder="09xx xxx xxx" /></label>
        </fieldset>
        <label>Ghi chú <span className="optional">Không bắt buộc</span><textarea rows="2" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Tình trạng chìa khóa..." /></label>
        {error && <p className="form-error">{error}</p>}
        <button className={`submit-button ${form.action === "NHẬN" ? "receive" : form.action === "MƯỢN" ? "borrow" : "deliver"}`} type="submit">Xác nhận {actionName(form.action)} chìa <span>→</span></button>
      </form>
    </section>
  </div>;
}

function RecordCard({ record, roomStock, actions, onOpen }) {
  const student = actionStudent(record);
  const tone = record.action === "NHẬN" ? "receive" : record.action === "MƯỢN" && record.returnedAt ? "returned" : record.action === "MƯỢN" ? "borrow" : "deliver";
  return <article className="record clickable" role="button" tabIndex="0" onClick={onOpen} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && onOpen()}>
    <div className={`record-icon ${tone}`}>{record.action === "NHẬN" || (record.action === "MƯỢN" && record.returnedAt) ? <ArrowDownToLine /> : record.action === "MƯỢN" ? <KeyRound /> : <ArrowUpFromLine />}</div>
    <div className="record-main"><div><strong>{record.building} · {record.room}</strong><span className={`pill ${tone}`}>{actionStatus(record)}</span><span className="quantity">{Number(record.quantity) || 1} chìa</span></div><p>{student?.name || "Không có tên"} · {student?.studentId || "—"}</p><small>{new Date(record.createdAt).toLocaleString("vi-VN")} · {student?.phone || "—"}{record.returnedAt ? ` · Phòng ${record.building}-${record.room} hiện có ${roomStock} chìa tại quầy · Trả ${new Date(record.returnedAt).toLocaleString("vi-VN")}` : ""}</small></div>
    {actions && <div className="record-actions" onClick={(event) => event.stopPropagation()}>{actions}</div>}
  </article>;
}

function RecordDetail({ record, roomStock, onClose }) {
  const [copied, setCopied] = useState("");
  const student = actionStudent(record);
  const rows = [
    ["Trạng thái", actionStatus(record)], ["Tòa - Phòng", `${record.building}-${record.room}`], ["Số lượng", `${Number(record.quantity) || 1} chìa`],
    ["Họ và tên", student?.name || "—"], ["MSSV", student?.studentId || "—"], ["Số điện thoại", student?.phone || "—"],
    ["Chìa tại quầy", `${roomStock} chìa`], ["Thời gian", new Date(record.createdAt).toLocaleString("vi-VN")], ["Ghi chú", record.note || "—"],
  ];
  async function copy(label, value) { await navigator.clipboard.writeText(value); setCopied(label); setTimeout(() => setCopied(""), 1400); }
  const all = rows.map(([label, value]) => `${label}: ${value}`).join("\n");
  return <div className="modal-backdrop detail-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="record-detail" role="dialog" aria-modal="true" aria-label="Chi tiết phiếu"><div className="modal-head"><div><small>CHI TIẾT PHIẾU</small><h3>{record.building}-{record.room} · {actionStatus(record)}</h3></div><button className="close" onClick={onClose} aria-label="Đóng"><X /></button></div><div className="detail-list">{rows.map(([label, value]) => <button key={label} onClick={() => copy(label, value)}><span><small>{label}</small><strong>{value}</strong></span><span className="copy-state">{copied === label ? "Đã chép" : <Copy />}</span></button>)}</div><button className="copy-all" onClick={() => copy("all", all)}><Copy /> {copied === "all" ? "Đã sao chép tất cả" : "Sao chép tất cả"}</button></section></div>;
}

function Empty() { return <div className="empty"><span><FileKey /></span><h4>Chưa có phiếu giao nhận</h4><p>Hoạt động mới sẽ xuất hiện tại đây.</p></div>; }

function Admin({ records, setRecords }) {
  const [loggedIn, setLoggedIn] = useState(sessionStorage.getItem("ktx-admin") === "yes");
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [detail, setDetail] = useState(null);
  const inventory = useMemo(() => calculateInventory(records), [records]);

  if (!loggedIn) return <AdminLogin onLogin={() => { sessionStorage.setItem("ktx-admin", "yes"); setLoggedIn(true); }} />;
  const filtered = records.filter((record) => {
    const student = actionStudent(record);
    return `${record.building} ${record.room} ${student?.name} ${student?.studentId} ${student?.phone}`.toLowerCase().includes(query.toLowerCase());
  });
  const available = [...inventory.values()].reduce((sum, value) => sum + value, 0);
  const borrowed = records.reduce((sum, record) => sum + (record.action === "MƯỢN" && !record.returnedAt ? Number(record.quantity) || 1 : 0), 0);

  function remove(id) { setRecords((old) => old.filter((item) => item.id !== id)); setConfirmAction(null); }
  function clearAll() { setRecords([]); setConfirmAction(null); }
  function saveEdit(record) { setRecords((old) => old.map((item) => item.id === editing.id ? { ...record, returnedAt: record.action === "MƯỢN" ? record.returnedAt : undefined, returnedQuantity: record.action === "MƯỢN" && record.returnedAt ? Number(record.quantity) || 1 : undefined, id: item.id, createdAt: item.createdAt } : item)); setEditing(null); }
  function add(record) { setRecords((old) => [{ ...record, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...old]); setAdding(false); }
  function returnBorrowed(id) { setRecords((old) => old.map((record) => record.id === id ? { ...record, returnedAt: new Date().toISOString(), returnedQuantity: Number(record.quantity) || 1 } : record)); }

  return <div className="admin-shell">
    <TopBar admin onMenu={() => setMenuOpen(true)} onLogout={() => { sessionStorage.removeItem("ktx-admin"); setLoggedIn(false); }} />
    <aside className={`admin-sidebar ${menuOpen ? "open" : ""}`}>
      <div className="sidebar-brand"><span className="brand-mark">CTU</span><div><strong>KTX B Đại Học Cần Thơ</strong><small>Hệ thống quản trị</small></div><button onClick={() => setMenuOpen(false)} aria-label="Đóng menu"><X /></button></div>
      <nav><a className="active" href="#overview" onClick={() => setMenuOpen(false)}><HomeIcon /> Tổng quan</a><a href="#records" onClick={() => setMenuOpen(false)}><History /> Phiếu giao nhận</a><a href="/"><KeyRound /> Trang người dùng</a></nav>
      <div className="sidebar-account"><ShieldCheck /><div><strong>Quản trị viên</strong><small>admin</small></div></div>
    </aside>
    {menuOpen && <button className="sidebar-scrim" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />}
    <main className="admin-main" id="overview">
      <div className="admin-heading"><div><span className="eyebrow">TRANG QUẢN TRỊ</span><h2>Quản lý giao nhận</h2><p>Kiểm tra và điều chỉnh toàn bộ dữ liệu chìa khóa.</p></div><button className="add-button" onClick={() => setAdding(true)}><Plus /> Thêm phiếu</button></div>
      <section className="admin-metrics"><Metric value={available} label="Chìa tại quầy" tone="green" icon={<KeyRound />} /><Metric value={records.length} label="Tổng phiếu" tone="blue" icon={<FileKey />} /><Metric value={borrowed} label="Lượt mượn chìa" tone="purple" icon={<KeyRound />} /><Metric value={new Set(records.map((r) => `${r.building}-${r.room}`)).size} label="Phòng có dữ liệu" tone="amber" icon={<Building2 />} /></section>
      <section className="admin-panel" id="records">
        <div className="admin-panel-title"><div><h3>Phiếu giao nhận</h3><p>{filtered.length} kết quả trong hệ thống</p></div></div>
        <div className="admin-tools"><div className="search-field"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tên, MSSV, SĐT, phòng..." /></div><div><button onClick={() => exportExcel(records)}><Download /> Xuất Excel</button><button className="danger-outline" onClick={() => setConfirmAction({ type: "all" })}><Trash2 /> Xóa sạch</button></div></div>
        <div className="admin-list">{filtered.length ? filtered.map((record) => <RecordCard key={record.id} record={record} roomStock={inventory.get(`${record.building}-${record.room}`) || 0} onOpen={() => setDetail(record)} actions={<>{record.action === "MƯỢN" && !record.returnedAt && <button className="return-borrowed" onClick={() => returnBorrowed(record.id)}><ArrowDownToLine /> <span>Trả chìa</span></button>}<button onClick={() => setEditing(record)} aria-label="Sửa phiếu"><Pencil /> <span>Sửa</span></button><button className="delete" onClick={() => setConfirmAction({ type: "one", id: record.id })} aria-label="Xóa phiếu"><Trash2 /> <span>Xóa</span></button></>} />) : <Empty />}</div>
      </section>
    </main>
    {(adding || editing) && <KeyModal action={editing?.action || "NHẬN"} initial={editing} inventory={inventory} onClose={() => { setAdding(false); setEditing(null); }} onSave={editing ? saveEdit : add} />}
    {detail && <RecordDetail record={detail} roomStock={inventory.get(`${detail.building}-${detail.room}`) || 0} onClose={() => setDetail(null)} />}
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
  return <main className="login-page"><section className="login-card"><div className="login-logo">CTU</div><span className="eyebrow">KTX B · ĐẠI HỌC CẦN THƠ</span><h1>Đăng nhập quản trị</h1><p>Hệ thống quản lý giao nhận chìa khóa sinh viên</p><form onSubmit={submit}><label>Tài khoản<input autoFocus required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nhập tài khoản" /></label><label>Mật khẩu<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nhập mật khẩu" /></label>{error && <p className="form-error">{error}</p>}<button className="submit-button receive">Đăng nhập <ArrowRight /></button></form><a href="/">← Về trang giao nhận</a></section></main>;
}

createRoot(document.getElementById("root")).render(<App />);
