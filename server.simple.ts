import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

/**
 * Serveur simplifié pour NovaSnap
 * 
 * ⚠️  Le serveur WebSocket pour Gemini Live a été supprimé.
 * Nova AI se connecte maintenant directement à l'API Google depuis le navigateur.
 * 
 * Ce serveur sert uniquement à :
 * - Servir les fichiers statiques en production
 * - Proxy Vite en développement
 * - Endpoint de santé pour monitoring
 */

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ 
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "2.0.0-direct-gemini"
    });
  });

  if (process.env.NODE_ENV !== "production") {
    // Mode développement : proxy Vite
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log('🔧 Mode développement : Vite middleware activé');
  } else {
    // Mode production : servir les fichiers statiques
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('📦 Mode production : fichiers statiques servis depuis /dist');
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 NovaSnap server running on http://localhost:${PORT}`);
    console.log(`✨ Nova AI : connexion directe à Gemini (pas de WebSocket serveur)`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('📴 SIGTERM reçu, arrêt gracieux...');
    server.close(() => {
      console.log('✅ Serveur arrêté');
      process.exit(0);
    });
  });
}

startServer().catch((err) => {
  console.error('❌ Erreur démarrage serveur:', err);
  process.exit(1);
});
