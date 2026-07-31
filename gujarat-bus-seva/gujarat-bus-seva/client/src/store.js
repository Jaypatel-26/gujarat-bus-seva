import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuth = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: "gbs-auth" }
  )
);

let toastId = 0;
export const useToast = create((set, get) => ({
  toasts: [],
  push: (type, message) => {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { id, type, message }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 4200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
export const toast = {
  ok: (m) => useToast.getState().push("ok", m),
  err: (m) => useToast.getState().push("err", m),
  info: (m) => useToast.getState().push("info", m),
};
