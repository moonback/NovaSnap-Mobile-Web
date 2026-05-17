import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useConversations } from '../hooks/useConversations';
import { Loader2, LogOut } from 'lucide-react';
import ConversationScreen from './ConversationScreen';

export default function ChatScreen() {
  const { data: conversations, isLoading } = useConversations();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (activeConversationId) {
    return (
      <ConversationScreen 
        conversationId={activeConversationId} 
        onBack={() => setActiveConversationId(null)} 
      />
    );
  }

  return (
    <div className="w-full h-full bg-[#050505] text-white flex flex-col pt-12 px-4 overflow-y-auto pb-24">
      <div className="flex justify-between items-center mb-6 mx-2">
        <h1 className="text-2xl font-bold">Conversations</h1>
        <div className="flex gap-2">
          <div className="w-8 h-8 rounded-md glass flex items-center justify-center cursor-pointer font-bold">+</div>
          <div onClick={handleLogout} className="w-8 h-8 rounded-md glass flex items-center justify-center cursor-pointer text-red-400">
            <LogOut size={16} />
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-3">
        {isLoading && (
          <div className="flex justify-center p-8 text-white/40">
            <Loader2 className="animate-spin" />
          </div>
        )}

        {!isLoading && conversations?.length === 0 && (
          <div className="text-center p-8 text-white/40 text-sm">
            No conversations yet.
          </div>
        )}

        {conversations?.map((convObj) => {
          const conv = convObj.conversations;
          if (!conv) return null;
          
          return (
            <div 
              key={conv.id} 
              onClick={() => setActiveConversationId(conv.id)}
              className="flex items-center gap-3 p-3 rounded-3xl glass hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-500 p-[1px]">
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center font-bold text-xs">
                  {conv.title?.substring(0, 2).toUpperCase() || 'CHAT'}
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-base">{conv.title || 'Conversation'}</h3>
                <p className="text-[12px] font-mono text-white/40">Say hi!</p>
              </div>
              <div className="w-3 h-3 rounded-full bg-cyan-400 neon-glow" />
            </div>
          );
        })}

        {/* Placeholder / Dummy to maintain original UI look if empty */}
        {!isLoading && conversations?.length === 0 && (
          <>
            <div className="flex items-center gap-3 p-3 rounded-3xl glass hover:bg-white/5 transition-colors cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-500 p-[1px]">
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center font-bold text-xs">TR</div>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-base">Team NovaSnap (Demo)</h3>
                <p className="text-[12px] font-mono text-cyan-400">New Snap • 2m ago</p>
              </div>
              <div className="w-3 h-3 rounded-full bg-cyan-400 neon-glow" />
            </div>
            <div className="flex items-center gap-3 p-3 rounded-3xl glass hover:bg-white/5 transition-colors cursor-pointer opacity-70">
              <div className="w-12 h-12 rounded-full bg-gray-700" />
              <div className="flex-1">
                <h3 className="font-bold text-base">Alice (Demo)</h3>
                <p className="text-[12px] text-white/40">Opened • 1h ago</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

