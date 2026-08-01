import { useEffect, useState } from "react";
import { api } from "../../api";
import { Modal, Skeleton } from "../../components/ui";
import { toast } from "../../store";

const EMPTY = { name: "", mobile: "", conductorId: "", password: "" };

/* Saare conductors — detail + password + add/edit/remove (admin aur conductor-console dono yahi use karte hain) */
export default function ConductorsPanel() {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // conductor id jab edit mode ho
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = () => api("/admin/drivers").then((d) => setRows(d.drivers)).catch((e) => toast.err(e.message));
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (d) => {
    setEditing(d.id);
    setForm({ name: d.name, mobile: d.mobile, conductorId: d.conductor_id || "", password: "" });
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      if (editing) {
        const body = { name: form.name, mobile: form.mobile, conductorId: form.conductorId };
        if (form.password) body.password = form.password;
        await api(`/admin/drivers/${editing}`, { method: "PUT", body });
        toast.ok("Conductor update ho gaya ✅");
      } else {
        await api("/admin/drivers", { method: "POST", body: form });
        toast.ok(`Conductor added ✅ — login: ${form.conductorId.toUpperCase()} / ${form.password}`);
      }
      setOpen(false); setEditing(null); setForm(EMPTY); load();
    } catch (e) { toast.err(e.message); }
    finally { setBusy(false); }
  };

  const del = async (id) => {
    try { await api(`/admin/drivers/${id}`, { method: "DELETE" }); toast.ok("Conductor removed"); load(); }
    catch (e) { toast.err(e.message); }
  };

  const canSave = editing
    ? form.name.trim() && form.mobile.length === 10 && /^GJ\d{3,}$/.test(form.conductorId.toUpperCase()) && (!form.password || form.password.length >= 6)
    : form.name.trim() && form.mobile.length === 10 && /^GJ\d{3,}$/.test(form.conductorId.toUpperCase()) && form.password.length >= 6;

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-display text-[15px] font-semibold">🎫 Conductors {rows ? <span className="text-xs text-slate-400">({rows.length})</span> : null}</h2>
          <p className="text-xs text-slate-500">Conductor ki puri detail — password bhi dikhta hai, add/edit/remove yahi se</p>
        </div>
        <button className="btn-brand py-1.5 text-xs" onClick={openAdd}>+ Add conductor</button>
      </div>

      {!rows ? (
        <Skeleton className="h-28 w-full" />
      ) : rows.length === 0 ? (
        <p className="rounded-lg bg-mist px-3 py-3 text-center text-xs text-slate-500">Koi conductor nahi — "+ Add conductor" se add karo.</p>
      ) : (
        <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-100">
          <table className="w-full min-w-[640px]">
            <thead className="sticky top-0 bg-mist/90"><tr className="text-left"><th className="th">Name</th><th className="th">Conductor ID</th><th className="th">Mobile</th><th className="th">Password</th><th className="th">Trips</th><th className="th"></th></tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-t border-slate-50 hover:bg-mist/60">
                  <td className="td font-medium">{d.name}</td>
                  <td className="td font-mono text-xs font-semibold text-brand-700">{d.conductor_id || "—"}</td>
                  <td className="td font-mono text-xs">{d.mobile}</td>
                  <td className="td"><span className="rounded bg-saffron-50 px-2 py-0.5 font-mono text-xs font-semibold text-saffron-700">{d.password || "—"}</span></td>
                  <td className="td">{d.trips}</td>
                  <td className="td text-right whitespace-nowrap">
                    <button className="mr-3 text-xs font-semibold text-brand-600 hover:underline" onClick={() => openEdit(d)}>✏️ Edit</button>
                    <button className="text-xs font-semibold text-danger-600 hover:underline" onClick={() => del(d.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows?.some((d) => !d.password) && (
        <p className="mt-2 text-[11px] text-slate-400">ℹ️ Jin conductors ka password "—" dikhe — unka password ek baar <b>✏️ Edit</b> se naya set kar lo (purane default conductors ka <b>conductor123</b> hai).</p>
      )}

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={editing ? "✏️ Edit conductor" : "Add conductor"}>
        <div className="space-y-3">
          <div><label className="label">Full name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Mobile</label><input className="input" maxLength={10} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "") })} /></div>
          <div><label className="label">Conductor ID (login isi se hoga)</label><input className="input font-mono" placeholder="GJ015503" value={form.conductorId} onChange={(e) => setForm({ ...form, conductorId: e.target.value.toUpperCase() })} /></div>
          <div><label className="label">Password</label>
            <input className="input" type="text" placeholder={editing ? "blank rakho to purana hi rahega" : "min 6 characters"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          {editing && <p className="rounded-lg bg-saffron-50 p-2 text-xs text-saffron-700">🔑 Naya password daaloge to wahi turant login ke liye active ho jayega aur upar list me dikhega.</p>}
          <p className="rounded-lg bg-mist p-2 text-xs text-slate-500">Conductor login page pe 🎫 role chun ke apni <b>Conductor ID + password</b> se login karega.</p>
          <button className="btn-primary w-full" disabled={busy || !canSave} onClick={save}>
            {busy ? "Saving…" : editing ? "Save changes" : "Save conductor"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
