export type AppView = 'chat' | 'camera' | 'stories';

export type AppUserProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type ConversationMessage = {
  id: string;
  content: string | null;
  message_type: string;
  created_at: string;
  sender_id: string;
  is_ephemeral?: boolean;
  is_saved?: boolean;
  opened_by?: string[];
};

export type ConversationMember = {
  user_id: string;
  users: {
    username: string | null;
    avatar_url: string | null;
  } | null;
};

export type ConversationDetails = {
  id: string;
  is_group: boolean;
  title: string | null;
  updated_at: string;
  messages: ConversationMessage[] | null;
  conversation_members: ConversationMember[] | null;
};

export type ConversationRow = {
  joined_at: string;
  last_read_at: string | null;
  conversations: ConversationDetails | null;
};

export type StoryRow = {
  id: string;
  media_url: string;
  media_type: string;
  created_at: string;
  expires_at: string;
  user_id: string;
  users: {
    username: string | null;
    avatar_url: string | null;
  } | null;
};

// ── Friends System ──────────────────────────────────────────

export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'BLOCKED';

export type Friendship = {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
};

export type FriendWithProfile = {
  friendship_id: string;
  friendship_status: FriendshipStatus;
  user: AppUserProfile & { bio?: string | null; snap_score?: number };
  is_requester: boolean; // true if current user sent the request
};
