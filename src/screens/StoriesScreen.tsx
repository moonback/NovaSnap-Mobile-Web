import React from 'react';

export default function StoriesScreen() {
  return (
    <div className="w-full h-full bg-[#050505] text-white flex flex-col pt-12 px-4 overflow-y-auto pb-24 gap-6">
      {/* AI Section from design HTML */}
      <div className="glass rounded-3xl p-6 flex flex-col gap-4 mt-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 neon-glow"></div>
          <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-tighter">Gemini Live AI</h3>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center gap-6 py-4">
          <div className="w-32 h-32 rounded-full voice-orb neon-glow flex items-center justify-center">
             <div className="w-28 h-28 rounded-full bg-black/40 backdrop-blur-sm"></div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-lg font-medium leading-tight">Listening for<br/>"Hey Nova"</p>
            <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Real-time Audio Streaming</p>
          </div>
        </div>

        <div className="p-4 glass-dark rounded-2xl border border-white/5">
          <p className="text-[11px] leading-relaxed text-white/60 italic">"Analyze this photo and tell me the name of that building..."</p>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-4 mx-2">Stories</h1>
        <div className="flex gap-4 overflow-x-auto scroll-hide pb-2">
          {/* Placeholder for Stories */}
          <div className="flex-shrink-0 w-24 space-y-2">
            <div className="aspect-[9/16] bg-gradient-to-b from-purple-500 to-pink-500 rounded-2xl relative overflow-hidden border border-white/20">
            </div>
            <p className="text-xs text-center font-medium truncate">My Story</p>
          </div>
          <div className="flex-shrink-0 w-24 space-y-2">
            <div className="aspect-[9/16] bg-gray-800 rounded-2xl relative overflow-hidden border-2 border-cyan-400">
            </div>
            <p className="text-xs text-center font-medium truncate">Lena K.</p>
          </div>
          <div className="flex-shrink-0 w-24 space-y-2 opacity-60">
            <div className="aspect-[9/16] bg-gray-800 rounded-2xl relative overflow-hidden border border-white/10">
            </div>
            <p className="text-xs text-center font-medium truncate">Tom H.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
