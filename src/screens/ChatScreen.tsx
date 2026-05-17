import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useConversations } from '../hooks/useConversations';
import { Loader2, LogOut, X } from 'lucide-react';
import ConversationScreen from './ConversationScreen';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../components/ui/ToastProvider';

export default function ChatScreen() {
  const { data: conversations, isLoading } = useConversations();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const { user } = useAppStore();
  const queryClient = useQueryClient();

  // Fetch all users to allow starting new conversations
  const { data: allUsers, isLoading: isUsersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, display_name, avatar_url');
      if (error) throw error;
      return data;
    },
    enabled: showNewChatModal
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleStartChat = async (targetUser: any) => {
    if (!user) return;
    setIsCreating(true);
    try {
      // 1. Check if a 1v1 conversation already exists between current user and target user
      const { data: myConversations, error: myConvError } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id);
        
      if (myConvError) throw myConvError;
      
      const myConvIds = myConversations.map(c => c.conversation_id);
      
      if (myConvIds.length > 0) {
        const { data: sharedMembers, error: sharedError } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .in('conversation_id', myConvIds)
          .eq('user_id', targetUser.id);
          
        if (sharedError) throw sharedError;
        
        if (sharedMembers && sharedMembers.length > 0) {
          // A conversation already exists! Open it.
          setActiveConversationId(sharedMembers[0].conversation_id);
          setShowNewChatModal(false);
          return;
        }
      }
      
      // 2. If no conversation exists, create a new one!
      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({
          is_group: false,
          title: targetUser.display_name || targetUser.username
        })
        .select()
        .single();
        
      if (createError) throw createError;
      
      // 3. Add members (current user & target user)
      const { error: memberError } = await supabase
        .from('conversation_members')
        .insert([
          { conversation_id: newConv.id, user_id: user.id },
          { conversation_id: newConv.id, user_id: targetUser.id }
        ]);
        
      if (memberError) throw memberError;
      
      // 4. Invalidate react-query cache to refresh list!
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });

      // 5. Set as active and close modal
      setActiveConversationId(newConv.id);
      setShowNewChatModal(false);
      
    } catch (e: any) {
      console.error(e);
      toast("Failed to start chat: " + e.message, "error");
    } finally {
      setIsCreating(false);
    }
  };

  const otherUsers = allUsers?.filter(u => u.id !== user?.id) || [];
  const filteredUsers = otherUsers.filter(u => 
    u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.display_name && u.display_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (activeConversationId) {
    return (
      <ConversationScreen 
        conversationId={activeConversationId} 
        onBack={() => setActiveConversationId(null)} 
      />
    );
  }

  return (
    <div className="w-full h-full bg-[#050505] text-white flex flex-col pt-12 px-4 overflow-y-auto pb-24 relative">
      <div className="flex justify-between items-center mb-6 mx-2">
        <h1 className="text-2xl font-bold">Conversations</h1>
        <div className="flex gap-2">
          <div 
            onClick={() => setShowNewChatModal(true)} 
            className="w-8 h-8 rounded-md glass flex items-center justify-center cursor-pointer font-bold hover:bg-white/10 transition-all"
          >
            +
          </div>
          <div onClick={handleLogout} className="w-8 h-8 rounded-md glass flex items-center justify-center cursor-pointer text-red-400 hover:bg-white/10 transition-all">
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

        {!isLoading && conversations && conversations.length > 0 && (
          conversations.map((convObj) => {
            const conv = convObj.conversations;
            if (!conv) return null;
            
            // Format sender and time info if any message exists
            const lastMsg = conv.messages && conv.messages[0];
            const hasNew = lastMsg && lastMsg.sender_id !== user?.id;

            return (
              <div 
                key={conv.id} 
                onClick={() => setActiveConversationId(conv.id)}
                className="flex items-center gap-3 p-3 rounded-3xl glass hover:bg-white/5 transition-colors cursor-pointer border border-white/5"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-400 to-purple-500 p-[1px]">
                  <div className="w-full h-full rounded-full bg-black flex items-center justify-center font-bold text-xs">
                    {conv.title?.substring(0, 2).toUpperCase() || 'CH'}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-base">{conv.title}</h3>
                  {lastMsg ? (
                    <p className={`text-[12px] ${hasNew ? 'text-cyan-400 font-bold' : 'text-white/40'}`}>
                      {lastMsg.message_type !== 'TEXT' ? '📷 Media' : lastMsg.content} • {new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  ) : (
                    <p className="text-[12px] text-white/30">No messages yet</p>
                  )}
                </div>
                {hasNew && <div className="w-3 h-3 rounded-full bg-cyan-400 neon-glow" />}
              </div>
            );
          })
        )}

        {!isLoading && (!conversations || conversations.length === 0) && (
          <>
            {/* Show nice empty state placeholder */}
            <div className="text-center p-8 glass rounded-3xl border border-white/5 mb-4">
              <p className="text-white/40 text-sm mb-4">No conversations yet.</p>
              <button 
                onClick={() => setShowNewChatModal(true)}
                className="px-6 py-2.5 bg-cyan-400 text-black font-bold rounded-full text-xs hover:bg-cyan-300 transition-all cursor-pointer"
              >
                Start a New Chat
              </button>
            </div>
            
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

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col p-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">New Chat</h2>
            <button 
              onClick={() => setShowNewChatModal(false)}
              className="w-10 h-10 rounded-full glass flex items-center justify-center text-white cursor-pointer hover:bg-white/10 transition-all"
            >
              <X size={20} />
            </button>
          </div>
          
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl h-12 px-4 text-white placeholder-white/30 mb-4 focus:outline-none focus:border-cyan-400 transition-colors font-medium"
          />
          
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-2">
            {isUsersLoading && (
              <div className="flex justify-center p-8 text-white/40">
                <Loader2 className="animate-spin" />
              </div>
            )}
            
            {!isUsersLoading && filteredUsers.length === 0 && (
              <div className="text-center p-8 text-white/40 text-sm">
                No users found.
              </div>
            )}
            
            {!isUsersLoading && filteredUsers.map((u) => (
              <div 
                key={u.id}
                onClick={() => handleStartChat(u)}
                className={`flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-white/5 ${isCreating ? 'pointer-events-none opacity-50' : ''}`}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-400 to-purple-500 flex items-center justify-center font-bold text-xs p-[1px]">
                  <div className="w-full h-full bg-black rounded-full flex items-center justify-center">
                    {u.username?.substring(0, 2).toUpperCase()}
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-sm text-white">{u.display_name || u.username}</h4>
                  <p className="text-xs text-white/40">@{u.username}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-cyan-400/10 flex items-center justify-center text-cyan-400 font-bold text-sm">
                  +
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

