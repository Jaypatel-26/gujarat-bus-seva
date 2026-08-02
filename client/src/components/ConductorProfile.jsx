import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import { toast, useAuth } from "../store";

const initials = (n) => (n || "C").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

// Image ko 256px me chhota karke base64 banata hai (DB me gaate hain, hamesha dikhta hai)
function fileToAvatar(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("Sirf image file chuno"));
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2, sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error("Image load nahi hui"));
    img.src = URL.createObjectURL(file);
  });
}

export default function ConductorProfile({ onClose }) {
  const { user, token, setAuth } = useAuth();
  const [form, setForm] = useState({ name: user?.name || "", mobile: user?.mobile || "", password: "" });
  const [photo, setPhoto] = useState(user?.photo_url || null);
  const [photoDirty, setPhotoDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const pickPhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const dataUrl = await fileToAvatar(f);
      setPhoto(dataUrl);
      setPhotoDirty(true);
    } catch (err) { toast.err(err.message); }
  };

  const save = async () => {
    if (busy) return;
    if (form.name.trim().length < 3) return toast.err("Naam kam se kam 3 letters ka ho");
    if (form.mobile.length !== 10) return toast.err("Sahi 10-digit mobile daalo");
    setBusy(true);
    try {
      const body = { name: form.name.trim(), mobile: form.mobile };
      if (form.password) body.password = form.password;
      if (photoDirty) body.photo = photo; // null = photo hata do
      const d = await api("/driver/me", { method: "PUT", body });
      setAuth(token, d.user); // session me updated user (photo samet)
      toast.ok("Profile save ho gaya ✅");
      onClose?.();
    } catch (e) { toast.err(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {/* photo block */}
      <div className="flex flex-col items-center gap-2">
        <motion.div
          key={photo ? "p" : "i"}
          initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-600 to-brand-900 text-3xl font-bold text-white shadow-lift ring-4 ring-brand-100"
        >
          {photo ? <img src={photo} alt="profile" className="h-full w-full object-cover" /> : initials(user?.name)}
        </motion.div>
        <div className="flex gap-2">
          <button className="chip border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100" onClick={() => fileRef.current?.click()}>
            📷 {photo ? "Photo badlo" : "Photo lagao"}
          </button>
          {photo && (
            <button className="chip border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" onClick={() => { setPhoto(null); setPhotoDirty(true); }}>
              🗑 Hatao
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
      </div>

      {/* locked ID */}
      <div className="flex items-center justify-between rounded-xl border-2 border-dashed border-slate-200 bg-mist px-4 py-3">
        <div>
          <p className="label !mb-0.5">Conductor ID</p>
          <p className="font-mono text-base font-bold text-brand-700">{user?.conductor_id || "—"}</p>
        </div>
        <span className="chip bg-slate-200/70 text-slate-500">🔒 locked</span>
      </div>
      <p className="-mt-2 text-center text-[11px] text-slate-400">Conductor ID kabhi nahi badal sakti — login isi se hota hai.</p>

      {/* editable fields */}
      <div><label className="label">Full name</label>
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><label className="label">Mobile</label>
        <input className="input" maxLength={10} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "") })} /></div>
      <div><label className="label">Naya password</label>
        <input className="input" type="text" placeholder="blank rakho to purana hi rahega" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>

      <button className="btn-primary w-full" disabled={busy} onClick={save}>{busy ? "Saving…" : "💾 Save profile"}</button>
    </div>
  );
}
