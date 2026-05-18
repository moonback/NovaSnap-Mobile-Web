/**
 * Edge Function: delete-account
 * 
 * Supprime complètement un compte utilisateur (données + auth)
 * Nécessite les droits admin (service role key)
 * 
 * Usage:
 *   POST /functions/v1/delete-account
 *   Headers: Authorization: Bearer <user_access_token>
 * 
 * Conforme RGPD: Droit à l'effacement (Article 17)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  try {
    // 1. Initialiser le client admin Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // 2. Vérifier l'authentification de l'utilisateur
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('[DeleteAccount] Missing authorization header')
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      console.error('[DeleteAccount] Unauthorized:', userError?.message)
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    console.log(`[DeleteAccount] 🗑️ Starting deletion for user ${user.id} (${user.email})`)

    // 3. Supprimer les données utilisateur dans l'ordre (contraintes FK)
    
    console.log('[DeleteAccount] Deleting story_views...')
    const { error: storyViewsError } = await supabaseAdmin
      .from('story_views')
      .delete()
      .eq('viewer_id', user.id)
    if (storyViewsError) console.warn('[DeleteAccount] story_views error:', storyViewsError.message)
    
    console.log('[DeleteAccount] Deleting stories...')
    const { error: storiesError } = await supabaseAdmin
      .from('stories')
      .delete()
      .eq('user_id', user.id)
    if (storiesError) console.warn('[DeleteAccount] stories error:', storiesError.message)
    
    console.log('[DeleteAccount] Deleting message_status...')
    const { error: messageStatusError } = await supabaseAdmin
      .from('message_status')
      .delete()
      .eq('user_id', user.id)
    if (messageStatusError) console.warn('[DeleteAccount] message_status error:', messageStatusError.message)
    
    console.log('[DeleteAccount] Deleting messages...')
    const { error: messagesError } = await supabaseAdmin
      .from('messages')
      .delete()
      .eq('sender_id', user.id)
    if (messagesError) console.warn('[DeleteAccount] messages error:', messagesError.message)
    
    console.log('[DeleteAccount] Deleting conversation_members...')
    const { error: conversationMembersError } = await supabaseAdmin
      .from('conversation_members')
      .delete()
      .eq('user_id', user.id)
    if (conversationMembersError) console.warn('[DeleteAccount] conversation_members error:', conversationMembersError.message)
    
    console.log('[DeleteAccount] Deleting friendships...')
    const { error: friendshipsError } = await supabaseAdmin
      .from('friendships')
      .delete()
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
    if (friendshipsError) console.warn('[DeleteAccount] friendships error:', friendshipsError.message)
    
    console.log('[DeleteAccount] Deleting notification_tokens...')
    const { error: notificationTokensError } = await supabaseAdmin
      .from('notification_tokens')
      .delete()
      .eq('user_id', user.id)
    if (notificationTokensError) console.warn('[DeleteAccount] notification_tokens error:', notificationTokensError.message)
    
    console.log('[DeleteAccount] Deleting user profile...')
    const { error: userProfileError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', user.id)
    if (userProfileError) console.warn('[DeleteAccount] users error:', userProfileError.message)

    // 4. Supprimer les fichiers storage
    console.log('[DeleteAccount] Deleting storage files...')
    const buckets = ['avatars', 'stories', 'chats', 'temporary_snaps']
    
    for (const bucket of buckets) {
      try {
        const { data: files, error: listError } = await supabaseAdmin.storage
          .from(bucket)
          .list(user.id)
        
        if (listError) {
          console.warn(`[DeleteAccount] Error listing ${bucket}:`, listError.message)
          continue
        }
        
        if (files && files.length > 0) {
          const filePaths = files.map(f => `${user.id}/${f.name}`)
          const { error: removeError } = await supabaseAdmin.storage
            .from(bucket)
            .remove(filePaths)
          
          if (removeError) {
            console.warn(`[DeleteAccount] Error removing files from ${bucket}:`, removeError.message)
          } else {
            console.log(`[DeleteAccount] ✅ Deleted ${files.length} files from ${bucket}`)
          }
        }
      } catch (err) {
        console.warn(`[DeleteAccount] Storage error for ${bucket}:`, err)
      }
    }

    // 5. Supprimer le compte auth (avec droits admin)
    console.log('[DeleteAccount] Deleting auth account...')
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    
    if (deleteAuthError) {
      console.error('[DeleteAccount] ❌ Auth deletion failed:', deleteAuthError.message)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to delete auth account', 
          details: deleteAuthError.message 
        }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    console.log(`[DeleteAccount] ✅ User ${user.id} fully deleted (RGPD compliant)`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Account deleted successfully',
        user_id: user.id,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    )

  } catch (error) {
    console.error('[DeleteAccount] ❌ Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    )
  }
})
