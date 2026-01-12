/**
 * WAHA (WhatsApp HTTP API) Comprehensive Client Library
 * Full implementation of all WAHA API endpoints
 * Documentation: https://waha.devlike.pro/docs/
 */

const WAHA_API_URL = process.env.WAHA_API_URL || 'https://waha.litbe.co.il'
const WAHA_API_KEY = process.env.WAHA_API_KEY || ''

// ============================================================================
// Core Fetch Utility
// ============================================================================

interface WAHAOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: unknown
  headers?: Record<string, string>
  timeout?: number
}

export async function wahaFetch<T>(endpoint: string, options: WAHAOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, timeout = 30000 } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(`${WAHA_API_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': WAHA_API_KEY,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const error = await response.text()
      throw new WAHAError(`WAHA API Error: ${response.status} - ${error}`, response.status, error)
    }

    // Handle empty responses
    const text = await response.text()
    if (!text) return {} as T

    return JSON.parse(text) as T
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof WAHAError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new WAHAError('Request timeout', 408, 'Request took too long')
    }
    throw error
  }
}

export class WAHAError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details: string
  ) {
    super(message)
    this.name = 'WAHAError'
  }
}

// ============================================================================
// WAHA API Client
// ============================================================================

export const waha = {
  // ==========================================================================
  // Sessions Management
  // ==========================================================================
  sessions: {
    /** List all sessions */
    list: (params?: { all?: boolean }) =>
      wahaFetch<Session[]>(`/api/sessions${params?.all ? '?all=true' : ''}`),

    /** Get session info */
    get: (session: string) =>
      wahaFetch<Session>(`/api/sessions/${session}`),

    /** Create a new session */
    create: (config: SessionConfig) =>
      wahaFetch<Session>('/api/sessions', {
        method: 'POST',
        body: config
      }),

    /** Update session configuration */
    update: (session: string, config: Partial<SessionConfig>) =>
      wahaFetch<Session>(`/api/sessions/${session}`, {
        method: 'PUT',
        body: config
      }),

    /** Delete a session */
    delete: (session: string) =>
      wahaFetch(`/api/sessions/${session}`, { method: 'DELETE' }),

    /** Start a session */
    start: (session: string) =>
      wahaFetch<Session>(`/api/sessions/${session}/start`, { method: 'POST' }),

    /** Stop a session */
    stop: (session: string) =>
      wahaFetch<Session>(`/api/sessions/${session}/stop`, { method: 'POST' }),

    /** Restart a session */
    restart: (session: string) =>
      wahaFetch<Session>(`/api/sessions/${session}/restart`, { method: 'POST' }),

    /** Logout from WhatsApp (unpair) */
    logout: (session: string) =>
      wahaFetch(`/api/sessions/${session}/logout`, { method: 'POST' }),

    /** Get authenticated account info */
    getMe: (session: string) =>
      wahaFetch<WAUser>(`/api/sessions/${session}/me`),

    /** Get screenshot of the session */
    getScreenshot: (session: string) =>
      wahaFetch<Screenshot>(`/api/screenshot?session=${session}`),
  },

  // ==========================================================================
  // Authentication
  // ==========================================================================
  auth: {
    /** Get QR code for pairing */
    getQR: (session: string, format: 'image' | 'raw' = 'image') =>
      wahaFetch<QRCode>(`/api/${session}/auth/qr?format=${format}`),

    /** Request authentication code (for phone number login) */
    requestCode: (session: string, phoneNumber: string, method: 'sms' | 'voice' = 'sms') =>
      wahaFetch(`/api/${session}/auth/request-code`, {
        method: 'POST',
        body: { phoneNumber, method }
      }),

    /** Submit authentication code */
    submitCode: (session: string, code: string) =>
      wahaFetch(`/api/${session}/auth/code`, {
        method: 'POST',
        body: { code }
      }),

    /** Get pairing code for linking */
    getPairingCode: (session: string, phoneNumber: string) =>
      wahaFetch<{ code: string }>(`/api/${session}/auth/pairing-code`, {
        method: 'POST',
        body: { phoneNumber }
      }),
  },

  // ==========================================================================
  // Messaging
  // ==========================================================================
  messages: {
    /** Send text message */
    sendText: (params: SendTextParams) =>
      wahaFetch<MessageResponse>('/api/sendText', {
        method: 'POST',
        body: params
      }),

    /** Send image */
    sendImage: (params: SendMediaParams) =>
      wahaFetch<MessageResponse>('/api/sendImage', {
        method: 'POST',
        body: params
      }),

    /** Send file/document */
    sendFile: (params: SendFileParams) =>
      wahaFetch<MessageResponse>('/api/sendFile', {
        method: 'POST',
        body: params
      }),

    /** Send voice message (OGG/OPUS format) */
    sendVoice: (params: SendVoiceParams) =>
      wahaFetch<MessageResponse>('/api/sendVoice', {
        method: 'POST',
        body: params
      }),

    /** Send video */
    sendVideo: (params: SendVideoParams) =>
      wahaFetch<MessageResponse>('/api/sendVideo', {
        method: 'POST',
        body: params
      }),

    /** Send location */
    sendLocation: (params: SendLocationParams) =>
      wahaFetch<MessageResponse>('/api/sendLocation', {
        method: 'POST',
        body: params
      }),

    /** Send contact vCard */
    sendContactVcard: (params: SendContactVcardParams) =>
      wahaFetch<MessageResponse>('/api/sendContactVcard', {
        method: 'POST',
        body: params
      }),

    /** Send poll */
    sendPoll: (params: SendPollParams) =>
      wahaFetch<MessageResponse>('/api/sendPoll', {
        method: 'POST',
        body: {
          session: params.session,
          chatId: params.chatId,
          poll: {
            name: params.name,
            options: params.options,
            multipleAnswers: params.multipleAnswers || false
          }
        }
      }),

    /** Send buttons (NOWEB engine only) */
    sendButtons: (params: SendButtonsParams) =>
      wahaFetch<MessageResponse>('/api/sendButtons', {
        method: 'POST',
        body: params
      }),

    /** Send list message */
    sendList: (params: SendListParams) =>
      wahaFetch<MessageResponse>('/api/sendList', {
        method: 'POST',
        body: params
      }),

    /** Forward message */
    forward: (params: ForwardMessageParams) =>
      wahaFetch<MessageResponse>('/api/forwardMessage', {
        method: 'POST',
        body: params
      }),

    /** Mark messages as read/seen */
    sendSeen: (params: SendSeenParams) =>
      wahaFetch('/api/sendSeen', {
        method: 'POST',
        body: params
      }),

    /** React to a message */
    react: (params: ReactionParams) =>
      wahaFetch('/api/reaction', {
        method: 'PUT',
        body: params
      }),

    /** Star/unstar a message */
    star: (params: StarParams) =>
      wahaFetch('/api/star', {
        method: 'PUT',
        body: params
      }),

    /** Edit a sent message */
    edit: (session: string, chatId: string, messageId: string, text: string) =>
      wahaFetch(`/api/${session}/chats/${chatId}/messages/${messageId}`, {
        method: 'PUT',
        body: { text }
      }),

    /** Delete a message */
    delete: (session: string, chatId: string, messageId: string, forEveryone = true) =>
      wahaFetch(`/api/${session}/chats/${chatId}/messages/${messageId}?forEveryone=${forEveryone}`, {
        method: 'DELETE'
      }),

    /** Get a specific message */
    get: (session: string, chatId: string, messageId: string) =>
      wahaFetch<Message>(`/api/${session}/chats/${chatId}/messages/${messageId}`),

    /** Send link with custom preview */
    sendLinkPreview: (params: SendLinkPreviewParams) =>
      wahaFetch<MessageResponse>('/api/send/link-custom-preview', {
        method: 'POST',
        body: params
      }),
  },

  // ==========================================================================
  // Chats
  // ==========================================================================
  chats: {
    /** Get all chats */
    list: (session: string, params?: ChatListParams) => {
      const queryParams = new URLSearchParams()
      if (params?.limit) queryParams.append('limit', params.limit.toString())
      if (params?.offset) queryParams.append('offset', params.offset.toString())
      if (params?.sortBy) queryParams.append('sortBy', params.sortBy)
      if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder)
      const query = queryParams.toString()
      return wahaFetch<Chat[]>(`/api/${session}/chats${query ? '?' + query : ''}`)
    },

    /** Get chats overview (optimized for UI) */
    overview: (session: string) =>
      wahaFetch<ChatOverview[]>(`/api/${session}/chats/overview`),

    /** Get chat by ID */
    get: (session: string, chatId: string) =>
      wahaFetch<Chat>(`/api/${session}/chats/${chatId}`),

    /** Delete chat */
    delete: (session: string, chatId: string) =>
      wahaFetch(`/api/${session}/chats/${chatId}`, { method: 'DELETE' }),

    /** Get chat picture */
    getPicture: (session: string, chatId: string, refresh = false) =>
      wahaFetch<{ url: string }>(`/api/${session}/chats/${chatId}/picture?refresh=${refresh}`),

    /** Archive chat */
    archive: (session: string, chatId: string) =>
      wahaFetch(`/api/${session}/chats/${chatId}/archive`, { method: 'POST' }),

    /** Unarchive chat */
    unarchive: (session: string, chatId: string) =>
      wahaFetch(`/api/${session}/chats/${chatId}/unarchive`, { method: 'POST' }),

    /** Mark chat as unread */
    markUnread: (session: string, chatId: string) =>
      wahaFetch(`/api/${session}/chats/${chatId}/unread`, { method: 'POST' }),

    /** Mark all messages as read */
    markRead: (session: string, chatId: string) =>
      wahaFetch(`/api/${session}/chats/${chatId}/messages/read`, { method: 'POST' }),

    /** Get messages from chat */
    getMessages: (session: string, chatId: string, params?: GetMessagesParams) => {
      const queryParams = new URLSearchParams()
      if (params?.limit) queryParams.append('limit', params.limit.toString())
      if (params?.offset) queryParams.append('offset', params.offset.toString())
      if (params?.downloadMedia !== undefined) queryParams.append('downloadMedia', params.downloadMedia.toString())
      const query = queryParams.toString()
      return wahaFetch<Message[]>(`/api/${session}/chats/${chatId}/messages${query ? '?' + query : ''}`)
    },

    /** Clear all messages in chat */
    clearMessages: (session: string, chatId: string) =>
      wahaFetch(`/api/${session}/chats/${chatId}/messages`, { method: 'DELETE' }),

    /** Pin a message */
    pinMessage: (session: string, chatId: string, messageId: string, duration: '24h' | '7d' | '30d' = '7d') =>
      wahaFetch(`/api/${session}/chats/${chatId}/messages/${messageId}/pin`, {
        method: 'POST',
        body: { duration }
      }),

    /** Unpin a message */
    unpinMessage: (session: string, chatId: string, messageId: string) =>
      wahaFetch(`/api/${session}/chats/${chatId}/messages/${messageId}/unpin`, { method: 'POST' }),
  },

  // ==========================================================================
  // Contacts
  // ==========================================================================
  contacts: {
    /** Get all contacts */
    list: (session: string, params?: ContactListParams) => {
      const queryParams = new URLSearchParams({ session })
      if (params?.limit) queryParams.append('limit', params.limit.toString())
      if (params?.offset) queryParams.append('offset', params.offset.toString())
      if (params?.sortBy) queryParams.append('sortBy', params.sortBy)
      if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder)
      return wahaFetch<Contact[]>(`/api/contacts/all?${queryParams.toString()}`)
    },

    /** Get contact by ID */
    get: (session: string, contactId: string) =>
      wahaFetch<Contact>(`/api/contacts?session=${session}&contactId=${contactId}`),

    /** Update contact (phone address book) */
    update: (session: string, chatId: string, data: { firstName?: string; lastName?: string }) =>
      wahaFetch(`/api/${session}/contacts/${chatId}`, {
        method: 'PUT',
        body: data
      }),

    /** Check if phone number exists on WhatsApp */
    checkExists: (session: string, phone: string) =>
      wahaFetch<CheckNumberResult>(`/api/contacts/check-exists?session=${session}&phone=${phone}`),

    /** Get contact profile picture */
    getProfilePicture: (session: string, contactId: string, refresh = false) =>
      wahaFetch<{ profilePictureURL: string }>(`/api/contacts/profile-picture?session=${session}&contactId=${contactId}&refresh=${refresh}`),

    /** Get contact's about/status text */
    getAbout: (session: string, contactId: string) =>
      wahaFetch<{ about: string }>(`/api/contacts/about?session=${session}&contactId=${contactId}`),

    /** Block a contact */
    block: (session: string, contactId: string) =>
      wahaFetch('/api/contacts/block', {
        method: 'POST',
        body: { session, contactId }
      }),

    /** Unblock a contact */
    unblock: (session: string, contactId: string) =>
      wahaFetch('/api/contacts/unblock', {
        method: 'POST',
        body: { session, contactId }
      }),
  },

  // ==========================================================================
  // Groups
  // ==========================================================================
  groups: {
    /** Get all groups */
    list: (session: string, params?: GroupListParams) => {
      const queryParams = new URLSearchParams()
      if (params?.limit) queryParams.append('limit', params.limit.toString())
      if (params?.offset) queryParams.append('offset', params.offset.toString())
      if (params?.sortBy) queryParams.append('sortBy', params.sortBy)
      if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder)
      const query = queryParams.toString()
      return wahaFetch<Group[]>(`/api/${session}/groups${query ? '?' + query : ''}`)
    },

    /** Get groups count */
    count: (session: string) =>
      wahaFetch<{ count: number }>(`/api/${session}/groups/count`),

    /** Get group by ID */
    get: (session: string, groupId: string) =>
      wahaFetch<Group>(`/api/${session}/groups/${groupId}`),

    /** Create a new group */
    create: (session: string, name: string, participants: string[]) =>
      wahaFetch<Group>(`/api/${session}/groups`, {
        method: 'POST',
        body: { name, participants: participants.map(id => ({ id })) }
      }),

    /** Delete a group */
    delete: (session: string, groupId: string) =>
      wahaFetch(`/api/${session}/groups/${groupId}`, { method: 'DELETE' }),

    /** Leave a group */
    leave: (session: string, groupId: string) =>
      wahaFetch(`/api/${session}/groups/${groupId}/leave`, { method: 'POST' }),

    /** Join group by invite code */
    join: (session: string, code: string) =>
      wahaFetch<{ id: string }>(`/api/${session}/groups/join`, {
        method: 'POST',
        body: { code }
      }),

    /** Get join info from invite code */
    getJoinInfo: (session: string, code: string) =>
      wahaFetch<GroupJoinInfo>(`/api/${session}/groups/join-info?code=${encodeURIComponent(code)}`),

    /** Refresh groups data */
    refresh: (session: string) =>
      wahaFetch(`/api/${session}/groups/refresh`, { method: 'POST' }),

    /** Get group picture */
    getPicture: (session: string, groupId: string) =>
      wahaFetch<{ url: string }>(`/api/${session}/groups/${groupId}/picture`),

    /** Set group picture */
    setPicture: (session: string, groupId: string, file: MediaFile) =>
      wahaFetch(`/api/${session}/groups/${groupId}/picture`, {
        method: 'PUT',
        body: { file }
      }),

    /** Delete group picture */
    deletePicture: (session: string, groupId: string) =>
      wahaFetch(`/api/${session}/groups/${groupId}/picture`, { method: 'DELETE' }),

    /** Update group subject/name */
    setSubject: (session: string, groupId: string, subject: string) =>
      wahaFetch(`/api/${session}/groups/${groupId}/subject`, {
        method: 'PUT',
        body: { subject }
      }),

    /** Update group description */
    setDescription: (session: string, groupId: string, description: string) =>
      wahaFetch(`/api/${session}/groups/${groupId}/description`, {
        method: 'PUT',
        body: { description }
      }),

    /** Get invite code */
    getInviteCode: (session: string, groupId: string) =>
      wahaFetch<{ code: string }>(`/api/${session}/groups/${groupId}/invite-code`),

    /** Revoke invite code (generate new one) */
    revokeInviteCode: (session: string, groupId: string) =>
      wahaFetch<{ code: string }>(`/api/${session}/groups/${groupId}/invite-code/revoke`, { method: 'POST' }),

    // Participants Management
    participants: {
      /** Get participants list */
      list: (session: string, groupId: string) =>
        wahaFetch<GroupParticipant[]>(`/api/${session}/groups/${groupId}/participants/v2`),

      /** Add participants */
      add: (session: string, groupId: string, participants: string[]) =>
        wahaFetch(`/api/${session}/groups/${groupId}/participants/add`, {
          method: 'POST',
          body: { participants: participants.map(id => ({ id })) }
        }),

      /** Remove participants */
      remove: (session: string, groupId: string, participants: string[]) =>
        wahaFetch(`/api/${session}/groups/${groupId}/participants/remove`, {
          method: 'POST',
          body: { participants: participants.map(id => ({ id })) }
        }),

      /** Promote to admin */
      promote: (session: string, groupId: string, participants: string[]) =>
        wahaFetch(`/api/${session}/groups/${groupId}/admin/promote`, {
          method: 'POST',
          body: { participants: participants.map(id => ({ id })) }
        }),

      /** Demote from admin */
      demote: (session: string, groupId: string, participants: string[]) =>
        wahaFetch(`/api/${session}/groups/${groupId}/admin/demote`, {
          method: 'POST',
          body: { participants: participants.map(id => ({ id })) }
        }),
    },

    // Group Settings
    settings: {
      /** Get admin-only info editing setting */
      getInfoAdminOnly: (session: string, groupId: string) =>
        wahaFetch<{ adminsOnly: boolean }>(`/api/${session}/groups/${groupId}/settings/security/info-admin-only`),

      /** Set admin-only info editing */
      setInfoAdminOnly: (session: string, groupId: string, adminsOnly: boolean) =>
        wahaFetch(`/api/${session}/groups/${groupId}/settings/security/info-admin-only`, {
          method: 'PUT',
          body: { adminsOnly }
        }),

      /** Get admin-only messaging setting */
      getMessagesAdminOnly: (session: string, groupId: string) =>
        wahaFetch<{ adminsOnly: boolean }>(`/api/${session}/groups/${groupId}/settings/security/messages-admin-only`),

      /** Set admin-only messaging */
      setMessagesAdminOnly: (session: string, groupId: string, adminsOnly: boolean) =>
        wahaFetch(`/api/${session}/groups/${groupId}/settings/security/messages-admin-only`, {
          method: 'PUT',
          body: { adminsOnly }
        }),
    },
  },

  // ==========================================================================
  // Channels (Newsletters)
  // ==========================================================================
  channels: {
    /** Get your channels */
    list: (session: string) =>
      wahaFetch<Channel[]>(`/api/${session}/channels`),

    /** Create a new channel */
    create: (session: string, name: string, description?: string) =>
      wahaFetch<Channel>(`/api/${session}/channels`, {
        method: 'POST',
        body: { name, description }
      }),

    /** Get channel by ID */
    get: (session: string, channelId: string) =>
      wahaFetch<Channel>(`/api/${session}/channels/${channelId}`),

    /** Delete a channel */
    delete: (session: string, channelId: string) =>
      wahaFetch(`/api/${session}/channels/${channelId}`, { method: 'DELETE' }),

    /** Get channel by invite code */
    getByInviteCode: (session: string, code: string) =>
      wahaFetch<Channel>(`/api/${session}/channels/invite/${code}`),

    /** Search public channels */
    search: (session: string, query: string, limit = 10) =>
      wahaFetch<Channel[]>(`/api/${session}/channels/search?query=${encodeURIComponent(query)}&limit=${limit}`),

    /** Follow a channel */
    follow: (session: string, channelId: string) =>
      wahaFetch(`/api/${session}/channels/${channelId}/follow`, { method: 'POST' }),

    /** Unfollow a channel */
    unfollow: (session: string, channelId: string) =>
      wahaFetch(`/api/${session}/channels/${channelId}/unfollow`, { method: 'POST' }),

    /** Mute a channel */
    mute: (session: string, channelId: string) =>
      wahaFetch(`/api/${session}/channels/${channelId}/mute`, { method: 'POST' }),

    /** Unmute a channel */
    unmute: (session: string, channelId: string) =>
      wahaFetch(`/api/${session}/channels/${channelId}/unmute`, { method: 'POST' }),

    // Channel Messages
    messages: {
      /** Get messages from channel */
      list: (session: string, channelId: string, limit = 50) =>
        wahaFetch<Message[]>(`/api/${session}/channels/${channelId}/messages?limit=${limit}`),

      /** Get message previews */
      preview: (session: string, channelId: string) =>
        wahaFetch<Message[]>(`/api/${session}/channels/${channelId}/messages/preview`),

      /** Post text to channel */
      sendText: (session: string, channelId: string, text: string) =>
        wahaFetch<MessageResponse>(`/api/${session}/channels/${channelId}/messages/text`, {
          method: 'POST',
          body: { text }
        }),

      /** Post image to channel */
      sendImage: (session: string, channelId: string, file: MediaFile, caption?: string) =>
        wahaFetch<MessageResponse>(`/api/${session}/channels/${channelId}/messages/image`, {
          method: 'POST',
          body: { file, caption }
        }),

      /** Post video to channel */
      sendVideo: (session: string, channelId: string, file: MediaFile, caption?: string) =>
        wahaFetch<MessageResponse>(`/api/${session}/channels/${channelId}/messages/video`, {
          method: 'POST',
          body: { file, caption }
        }),

      /** React to channel message */
      react: (session: string, channelId: string, messageId: string, reaction: string) =>
        wahaFetch(`/api/${session}/channels/reaction`, {
          method: 'POST',
          body: { channelId, messageId, reaction }
        }),
    },
  },

  // ==========================================================================
  // Status/Stories
  // ==========================================================================
  status: {
    /** Post text status */
    sendText: (session: string, text: string, backgroundColor?: string, font?: number) =>
      wahaFetch(`/api/${session}/status/text`, {
        method: 'POST',
        body: { text, backgroundColor, font }
      }),

    /** Post image status */
    sendImage: (session: string, file: MediaFile, caption?: string) =>
      wahaFetch(`/api/${session}/status/image`, {
        method: 'POST',
        body: { file, caption }
      }),

    /** Post voice status */
    sendVoice: (session: string, file: MediaFile) =>
      wahaFetch(`/api/${session}/status/voice`, {
        method: 'POST',
        body: { file }
      }),

    /** Post video status */
    sendVideo: (session: string, file: MediaFile, caption?: string) =>
      wahaFetch(`/api/${session}/status/video`, {
        method: 'POST',
        body: { file, caption }
      }),

    /** Delete status */
    delete: (session: string, messageId: string) =>
      wahaFetch(`/api/${session}/status/delete`, {
        method: 'POST',
        body: { messageId }
      }),

    /** Get new status message ID */
    getNewMessageId: (session: string) =>
      wahaFetch<{ id: string }>(`/api/${session}/status/new-message-id`),
  },

  // ==========================================================================
  // Presence
  // ==========================================================================
  presence: {
    /** Set your presence status */
    set: (session: string, presence: 'online' | 'offline') =>
      wahaFetch(`/api/${session}/presence`, {
        method: 'POST',
        body: { presence }
      }),

    /** Set online presence */
    setOnline: (session: string) =>
      wahaFetch(`/api/${session}/presence`, {
        method: 'POST',
        body: { presence: 'online' }
      }),

    /** Set offline presence */
    setOffline: (session: string) =>
      wahaFetch(`/api/${session}/presence`, {
        method: 'POST',
        body: { presence: 'offline' }
      }),

    /** Get presence for a chat */
    getForChat: (session: string, chatId: string) =>
      wahaFetch<PresenceInfo>(`/api/${session}/chats/${chatId}/presence`),

    /** Get presence for all chats */
    getAll: (session: string) =>
      wahaFetch<PresenceInfo[]>(`/api/${session}/chats/presence`),

    /** Subscribe to presence updates */
    subscribe: (session: string, chatId: string) =>
      wahaFetch(`/api/${session}/presence/subscribe`, {
        method: 'POST',
        body: { chatId }
      }),

    /** Start typing indicator */
    startTyping: (session: string, chatId: string) =>
      wahaFetch('/api/startTyping', {
        method: 'POST',
        body: { session, chatId }
      }),

    /** Stop typing indicator */
    stopTyping: (session: string, chatId: string) =>
      wahaFetch('/api/stopTyping', {
        method: 'POST',
        body: { session, chatId }
      }),

    /** Start recording indicator */
    startRecording: (session: string, chatId: string) =>
      wahaFetch('/api/startRecording', {
        method: 'POST',
        body: { session, chatId }
      }),

    /** Stop recording indicator */
    stopRecording: (session: string, chatId: string) =>
      wahaFetch('/api/stopRecording', {
        method: 'POST',
        body: { session, chatId }
      }),
  },

  // ==========================================================================
  // Labels (WhatsApp Business)
  // ==========================================================================
  labels: {
    /** Get all labels */
    list: (session: string) =>
      wahaFetch<Label[]>(`/api/${session}/labels`),

    /** Create a label */
    create: (session: string, name: string, color: number | string) =>
      wahaFetch<Label>(`/api/${session}/labels`, {
        method: 'POST',
        body: typeof color === 'string' ? { name, colorHex: color } : { name, color }
      }),

    /** Update a label */
    update: (session: string, labelId: string, data: { name?: string; color?: number; colorHex?: string }) =>
      wahaFetch<Label>(`/api/${session}/labels/${labelId}`, {
        method: 'PUT',
        body: data
      }),

    /** Delete a label */
    delete: (session: string, labelId: string) =>
      wahaFetch(`/api/${session}/labels/${labelId}`, { method: 'DELETE' }),

    /** Get chats with a specific label */
    getChats: (session: string, labelId: string) =>
      wahaFetch<Chat[]>(`/api/${session}/labels/${labelId}/chats`),

    /** Get labels for a chat */
    getChatLabels: (session: string, chatId: string) =>
      wahaFetch<Label[]>(`/api/${session}/labels/chats/${chatId}/`),

    /** Set labels for a chat */
    setChatLabels: (session: string, chatId: string, labelIds: string[]) =>
      wahaFetch(`/api/${session}/labels/chats/${chatId}/`, {
        method: 'PUT',
        body: { labels: labelIds.map(id => ({ id })) }
      }),
  },

  // ==========================================================================
  // Media
  // ==========================================================================
  media: {
    /** Download media from message */
    download: (session: string, messageId: string) =>
      wahaFetch<MediaDownload>(`/api/${session}/media?messageId=${messageId}`),

    /** Convert audio to voice format */
    convertToVoice: (session: string, file: MediaFile) =>
      wahaFetch<MediaFile>(`/api/${session}/media/convert/voice`, {
        method: 'POST',
        body: { file }
      }),

    /** Convert video for WhatsApp */
    convertVideo: (session: string, file: MediaFile) =>
      wahaFetch<MediaFile>(`/api/${session}/media/convert/video`, {
        method: 'POST',
        body: { file }
      }),
  },

  // ==========================================================================
  // Profile
  // ==========================================================================
  profile: {
    /** Get own profile picture */
    getPicture: (session: string) =>
      wahaFetch<{ url: string }>(`/api/${session}/profile/picture`),

    /** Set own profile picture */
    setPicture: (session: string, file: MediaFile) =>
      wahaFetch(`/api/${session}/profile/picture`, {
        method: 'PUT',
        body: { file }
      }),

    /** Delete own profile picture */
    deletePicture: (session: string) =>
      wahaFetch(`/api/${session}/profile/picture`, { method: 'DELETE' }),

    /** Get own about/status text */
    getAbout: (session: string) =>
      wahaFetch<{ about: string }>(`/api/${session}/profile/about`),

    /** Set own about/status text */
    setAbout: (session: string, about: string) =>
      wahaFetch(`/api/${session}/profile/about`, {
        method: 'PUT',
        body: { about }
      }),

    /** Get own display name */
    getName: (session: string) =>
      wahaFetch<{ name: string }>(`/api/${session}/profile/name`),

    /** Set own display name */
    setName: (session: string, name: string) =>
      wahaFetch(`/api/${session}/profile/name`, {
        method: 'PUT',
        body: { name }
      }),
  },

  // ==========================================================================
  // Server Info
  // ==========================================================================
  server: {
    /** Get server version */
    version: () => wahaFetch<{ version: string; engine: string }>('/api/version'),

    /** Get server health */
    health: () => wahaFetch<{ status: string }>('/health'),

    /** Get server environment */
    environment: () => wahaFetch<Record<string, string>>('/api/server/environment'),
  },
}

// ============================================================================
// Type Definitions
// ============================================================================

// Session Types
export interface Session {
  name: string
  status: SessionStatus
  me?: WAUser
  config?: SessionConfigResponse
}

export type SessionStatus = 'STARTING' | 'SCAN_QR_CODE' | 'WORKING' | 'FAILED' | 'STOPPED'

export interface SessionConfig {
  name: string
  start?: boolean
  config?: {
    webhooks?: WebhookConfig[]
    proxy?: string
    debug?: boolean
    noweb?: {
      store?: {
        enabled?: boolean
        fullSync?: boolean
      }
    }
  }
}

export interface SessionConfigResponse {
  webhooks?: WebhookConfig[]
  proxy?: string | null
}

export interface WebhookConfig {
  url: string
  events?: WebhookEvent[]
  hmac?: {
    key: string
  }
  retries?: {
    delaySeconds: number
    attempts: number
  }
  customHeaders?: { name: string; value: string }[]
}

export type WebhookEvent =
  | 'message'
  | 'message.any'
  | 'message.ack'
  | 'message.reaction'
  | 'message.revoked'
  | 'message.waiting'
  | 'session.status'
  | 'chat.archive'
  | 'group.join'
  | 'group.leave'
  | 'presence.update'
  | 'poll.vote'
  | 'poll.vote.failed'
  | 'label.upsert'
  | 'label.deleted'
  | 'label.chat.added'
  | 'label.chat.deleted'
  | 'call.received'
  | 'call.accepted'
  | 'call.rejected'

export interface WAUser {
  id: string
  pushName: string
  name?: string
}

export interface QRCode {
  value: string
  mimetype: string
}

export interface Screenshot {
  mimetype: string
  data: string
}

// Message Types
export interface Message {
  id: string
  body: string
  type: MessageType
  timestamp: number
  from: string
  to: string
  fromMe: boolean
  hasMedia: boolean
  ack: MessageAck
  participant?: string
  author?: string
  quotedMsg?: Message
  media?: MessageMedia
  location?: LocationData
  vCards?: string[]
  mentionedIds?: string[]
  links?: LinkInfo[]
}

export type MessageType =
  | 'chat'
  | 'image'
  | 'video'
  | 'audio'
  | 'ptt'
  | 'document'
  | 'sticker'
  | 'location'
  | 'vcard'
  | 'multi_vcard'
  | 'revoked'
  | 'poll_creation'
  | 'reaction'
  | 'unknown'

export type MessageAck = 0 | 1 | 2 | 3 | 4 // error, pending, server, delivery, read

export interface MessageMedia {
  url?: string
  mimetype: string
  filename?: string
  error?: string
}

export interface MessageResponse {
  id: string
  timestamp: number
  ack?: MessageAck
}

// Send Message Parameters
export interface SendTextParams {
  session: string
  chatId: string
  text: string
  reply_to?: string
  mentions?: string[]
  linkPreview?: boolean
}

export interface SendMediaParams {
  session: string
  chatId: string
  file: MediaFile
  caption?: string
  reply_to?: string
  mentions?: string[]
}

export interface SendFileParams extends SendMediaParams {
  filename?: string
}

export interface SendVoiceParams {
  session: string
  chatId: string
  file: MediaFile
  reply_to?: string
  convert?: boolean // Auto-convert to OGG/OPUS - let WAHA handle format conversion
}

export interface SendVideoParams extends SendMediaParams {
  asNote?: boolean // Send as video note (rounded)
  convert?: boolean
}

export interface SendLocationParams {
  session: string
  chatId: string
  latitude: number
  longitude: number
  title?: string
  address?: string
  reply_to?: string
}

export interface SendContactVcardParams {
  session: string
  chatId: string
  vcard: string | { name: string; phone: string }
  reply_to?: string
}

export interface SendPollParams {
  session: string
  chatId: string
  name: string // Poll question
  options: string[] // Poll options
  multipleAnswers?: boolean
}

export interface SendButtonsParams {
  session: string
  chatId: string
  text: string
  footer?: string
  buttons: { id: string; text: string }[]
}

export interface SendListParams {
  session: string
  chatId: string
  text: string
  footer?: string
  buttonText: string
  sections: {
    title: string
    rows: { id: string; title: string; description?: string }[]
  }[]
}

export interface ForwardMessageParams {
  session: string
  chatId: string
  messageId: string
}

export interface SendSeenParams {
  session: string
  chatId: string
  messageIds?: string[]
}

export interface ReactionParams {
  session: string
  messageId: string
  reaction: string // emoji or empty string to remove
}

export interface StarParams {
  session: string
  messageId: string
  star: boolean
}

export interface SendLinkPreviewParams {
  session: string
  chatId: string
  url: string
  title: string
  description?: string
  text?: string
}

export interface MediaFile {
  url?: string
  data?: string // base64
  mimetype?: string
  filename?: string
}

// Chat Types
export interface Chat {
  id: string
  name: string
  isGroup: boolean
  isReadOnly?: boolean
  unreadCount: number
  timestamp: number
  lastMessage?: Message
  archived?: boolean
  pinned?: boolean
  muted?: boolean
  muteExpiration?: number
}

export interface ChatOverview {
  id: string
  name: string
  picture?: string
  lastMessage?: string
  lastMessageTime?: number
  unreadCount: number
}

export interface ChatListParams {
  limit?: number
  offset?: number
  sortBy?: 'id' | 'timestamp'
  sortOrder?: 'asc' | 'desc'
}

export interface GetMessagesParams {
  limit?: number
  offset?: number
  downloadMedia?: boolean
}

// Contact Types
export interface Contact {
  id: string
  name: string
  pushname: string
  shortName?: string
  isMyContact: boolean
  isBlocked: boolean
  isWAContact?: boolean
  number?: string
}

export interface ContactListParams {
  limit?: number
  offset?: number
  sortBy?: 'id' | 'name'
  sortOrder?: 'asc' | 'desc'
}

export interface CheckNumberResult {
  numberExists: boolean
  chatId?: string
  isBusiness?: boolean
}

// Group Types
export interface Group {
  id: string
  name: string
  subject?: string
  description?: string
  owner?: string
  creation?: number
  participants: GroupParticipant[]
  admins?: string[]
  inviteCode?: string
  picture?: string
}

export interface GroupParticipant {
  id: string
  isAdmin: boolean
  isSuperAdmin: boolean
  role?: 'participant' | 'admin' | 'superadmin' | 'left'
}

export interface GroupJoinInfo {
  id: string
  subject: string
  owner: string
  creation: number
  description?: string
  participants: number
}

export interface GroupListParams {
  limit?: number
  offset?: number
  sortBy?: 'id' | 'subject'
  sortOrder?: 'asc' | 'desc'
}

// Channel Types
export interface Channel {
  id: string
  name: string
  description?: string
  picture?: string
  verified?: boolean
  subscribers?: number
  createdAt?: number
}

// Label Types
export interface Label {
  id: string
  name: string
  color: number
  colorHex?: string
}

// Presence Types
export interface PresenceInfo {
  chatId: string
  presence: 'available' | 'unavailable' | 'composing' | 'recording'
  lastSeen?: number
}

// Location Types
export interface LocationData {
  latitude: number
  longitude: number
  description?: string
  name?: string
  address?: string
  url?: string
}

export interface LinkInfo {
  link: string
  isSuspicious: boolean
}

export interface MediaDownload {
  mimetype: string
  data: string // base64
  filename?: string
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format phone number to WhatsApp chat ID format
 */
export function formatChatId(phone: string, isGroup = false): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '')

  if (isGroup) {
    return `${cleaned}@g.us`
  }

  // Add @c.us suffix for personal chats
  return `${cleaned}@c.us`
}

/**
 * Extract phone number from chat ID
 */
export function extractPhone(chatId: string): string {
  return chatId.split('@')[0]
}

/**
 * Check if chat ID is a group
 */
export function isGroupId(chatId: string): boolean {
  return chatId.endsWith('@g.us')
}

/**
 * Check if chat ID is a channel
 */
export function isChannelId(chatId: string): boolean {
  return chatId.endsWith('@newsletter')
}

/**
 * Check if chat ID is a status broadcast
 */
export function isStatusBroadcast(chatId: string): boolean {
  return chatId === 'status@broadcast'
}

/**
 * Convert file to base64
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const result = reader.result as string
      // Remove data URL prefix
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
  })
}

/**
 * Create MediaFile from File object
 */
export async function createMediaFile(file: File): Promise<MediaFile> {
  const base64 = await fileToBase64(file)
  return {
    data: base64,
    mimetype: file.type,
    filename: file.name
  }
}

/**
 * Parse webhook payload
 */
export function parseWebhookPayload<T = unknown>(body: unknown): WebhookPayload<T> {
  return body as WebhookPayload<T>
}

export interface WebhookPayload<T = unknown> {
  event: WebhookEvent
  session: string
  engine: string
  payload: T
}

// Export default
export default waha
