import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "localhost",
    port: 5173,
    proxy: {
      "/reviews": { target: "http://localhost:8000", changeOrigin: true, secure: false },
    "/api": { target: "http://localhost:8000", changeOrigin: true, secure: false },
      "/users": { target: "http://localhost:8000", changeOrigin: true, secure: false },
      "/ws":    { target: "ws://localhost:8000", ws: true }, // 웹소켓 쓰면
     "/media": { target: "http://localhost:8000", changeOrigin: true, secure: false },

    }
  }
});
