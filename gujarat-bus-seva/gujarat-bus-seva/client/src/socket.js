import { io } from "socket.io-client";

const url = import.meta.env.VITE_API_URL || undefined; // dev: same origin via Vite proxy
export const socket = io(url, { transports: ["websocket", "polling"] });
