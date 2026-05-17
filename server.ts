import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { WebSocketServer } from "ws";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => { // using express v5 or default
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on("connection", async (clientWs) => {
    console.log("Client connected to /live");

    try {
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onmessage: (message) => {
            const parts = message.serverContent?.modelTurn?.parts || [];
            
            const audioData = parts.find((p: any) => p.inlineData)?.inlineData?.data;
            if (audioData) clientWs.send(JSON.stringify({ audio: audioData }));
            
            const textData = parts.find((p: any) => p.text)?.text;
            if (textData) clientWs.send(JSON.stringify({ text: textData }));

            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are Nova, an AI assistant built into the NovaSnap app. You are helpful, friendly, and concise. You can see things if the user provides video/camera frames.",
        },
      });

      clientWs.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.audio) {
            session.sendRealtimeInput({
              audio: {
                mimeType: "audio/pcm;rate=16000",
                data: msg.audio
              }
            });
          }
          if (msg.video) {
            session.sendRealtimeInput({
              video: {
                mimeType: "image/jpeg",
                data: msg.video
              }
            });
          }
        } catch (e) {
          console.error("Error processing websocket message", e);
        }
      });

      clientWs.on("close", () => {
        console.log("Client disconnected from /live");
        if (typeof session.close === 'function') {
           session.close();
        }
      });
      
    } catch (e) {
      console.error("Error establishing Gemini Live session:", e);
      clientWs.close();
    }
  });
}

startServer();
