import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/moss-image-sft-canvas/",
  plugins: [react()],
});
