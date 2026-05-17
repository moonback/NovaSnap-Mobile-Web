import React from 'react';

export default function ChatScreen() {
  return (
    <div className="w-full h-full bg-[#050505] text-white flex flex-col pt-12 px-4 overflow-y-auto pb-24">
      <div className="flex justify-between items-center mb-6 mx-2">
        <h1 className="text-2xl font-bold">Conversations</h1>
        <div className="w-8 h-8 rounded-md glass flex items-center justify-center cursor-pointer font-bold">+</div>
      </div>
      <div className="flex-1 flex flex-col gap-3">
        {/* Placeholder for chats */}
        <div className="flex items-center gap-3 p-3 rounded-3xl glass hover:bg-white/5 transition-colors cursor-pointer">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-500 p-[1px]">
            <div className="w-full h-full rounded-full bg-black flex items-center justify-center font-bold text-xs">TR</div>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-base">Team NovaSnap</h3>
            <p className="text-[12px] font-mono text-cyan-400">New Snap • 2m ago</p>
          </div>
          <div className="w-3 h-3 rounded-full bg-cyan-400 neon-glow" />
        </div>
        <div className="flex items-center gap-3 p-3 rounded-3xl glass hover:bg-white/5 transition-colors cursor-pointer opacity-70">
          <div className="w-12 h-12 rounded-full bg-gray-700" />
          <div className="flex-1">
            <h3 className="font-bold text-base">Alice</h3>
            <p className="text-[12px] text-white/40">Opened • 1h ago</p>
          </div>
        </div>
      </div>
    </div>
  );
}
