// vite.config.js
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "localhost",
    port: 5173,
    proxy: {
      "/reviews": { target: "http://localhost:8000", changeOrigin: true, secure: false },
      "/api":     { target: "http://localhost:8000", changeOrigin: true, secure: false },
      "/users":   { target: "http://localhost:8000", changeOrigin: true, secure: false },
      "/ws":      { target: "ws://localhost:8000", ws: true },
      "/media":   { target: "http://localhost:8000", changeOrigin: true, secure: false },
    },
  },
  build: {
    rollupOptions: {
      input: {
        index:     "index.html",
        onboarding:"onboarding/on.html",
        home:      "home/home.html",
        chat:      "chat/chat-list.html",   // 파일명/경로 정확히!
        profile:   "profile/profile.html",
        pre: "profile/pre.html",
        login: "login/login.html",
        signup: "login/signup.html",
        chatroom: "chat/chat-room.html",
        reviewView: "review/review-view.html",
        reviewWrite: "review/review-write.html",

      },
    },
  },
});
