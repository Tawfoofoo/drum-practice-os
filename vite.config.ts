import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  plugins:[react(),VitePWA({registerType:'autoUpdate',includeAssets:['icon.svg'],manifest:{name:'Drum Practice OS',short_name:'Drum OS',description:'Adaptive drum practice planner and metronome',theme_color:'#101827',background_color:'#101827',display:'standalone',start_url:'/',icons:[{src:'icon-192.png',sizes:'192x192',type:'image/png',purpose:'any maskable'},{src:'icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]}})],
  base:'/'
});
