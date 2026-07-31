import { io } from "socket.io-client";

const raw = import.meta.env.VITE_API_URL || "";
// dev: same origin via Vite proxy; Render: bare host → prepend scheme
const url = raw ? (/^https?:\/\//.test(raw) ? raw : `https://${raw}`) : undefined;
export const socket = io(url, { transports: ["websocket", "polling"] });
