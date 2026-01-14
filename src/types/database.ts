export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          company_name: string | null
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          company_name?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          company_name?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      connections: {
        Row: {
          id: string
          user_id: string
          session_name: string
          phone_number: string | null
          display_name: string | null
          status: 'connected' | 'disconnected' | 'connecting' | 'qr_pending'
          first_connected_at: string | null
          last_seen_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          session_name: string
          phone_number?: string | null
          display_name?: string | null
          status?: 'connected' | 'disconnected' | 'connecting' | 'qr_pending'
          first_connected_at?: string | null
          last_seen_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          session_name?: string
          phone_number?: string | null
          display_name?: string | null
          status?: 'connected' | 'disconnected' | 'connecting' | 'qr_pending'
          first_connected_at?: string | null
          last_seen_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      contact_lists: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          contact_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          contact_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          contact_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      contacts: {
        Row: {
          id: string
          list_id: string
          phone: string
          name: string | null
          email: string | null
          variables: Record<string, string>
          is_blacklisted: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          list_id: string
          phone: string
          name?: string | null
          email?: string | null
          variables?: Record<string, string>
          is_blacklisted?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          list_id?: string
          phone?: string
          name?: string | null
          email?: string | null
          variables?: Record<string, string>
          is_blacklisted?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      campaigns: {
        Row: {
          id: string
          user_id: string
          connection_id: string
          list_id: string | null
          name: string
          message_template: string
          media_url: string | null
          media_type: 'image' | 'video' | 'document' | 'audio' | null
          status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
          scheduled_at: string | null
          started_at: string | null
          completed_at: string | null
          paused_at: string | null
          total_recipients: number
          sent_count: number
          delivered_count: number
          read_count: number
          failed_count: number
          reply_count: number
          delay_min: number
          delay_max: number
          pause_after_messages: number | null
          pause_seconds: number | null
          estimated_duration: number | null
          new_list_name: string | null
          existing_list_id: string | null
          multi_device: boolean
          device_ids: string[] | null
          message_variations: string[] | null
          poll_question: string | null
          poll_options: string[] | null
          poll_multiple_answers: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          connection_id: string
          list_id?: string | null
          name: string
          message_template: string
          media_url?: string | null
          media_type?: 'image' | 'video' | 'document' | 'audio' | null
          status?: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
          scheduled_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          paused_at?: string | null
          total_recipients?: number
          sent_count?: number
          delivered_count?: number
          read_count?: number
          failed_count?: number
          reply_count?: number
          delay_min?: number
          delay_max?: number
          pause_after_messages?: number | null
          pause_seconds?: number | null
          estimated_duration?: number | null
          new_list_name?: string | null
          existing_list_id?: string | null
          multi_device?: boolean
          device_ids?: string[] | null
          message_variations?: string[] | null
          poll_question?: string | null
          poll_options?: string[] | null
          poll_multiple_answers?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          connection_id?: string
          list_id?: string | null
          name?: string
          message_template?: string
          media_url?: string | null
          media_type?: 'image' | 'video' | 'document' | 'audio' | null
          status?: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
          scheduled_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          paused_at?: string | null
          total_recipients?: number
          sent_count?: number
          delivered_count?: number
          read_count?: number
          failed_count?: number
          reply_count?: number
          delay_min?: number
          delay_max?: number
          pause_after_messages?: number | null
          pause_seconds?: number | null
          estimated_duration?: number | null
          new_list_name?: string | null
          existing_list_id?: string | null
          multi_device?: boolean
          device_ids?: string[] | null
          message_variations?: string[] | null
          poll_question?: string | null
          poll_options?: string[] | null
          poll_multiple_answers?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      campaign_messages: {
        Row: {
          id: string
          campaign_id: string
          contact_id: string
          phone: string
          message_content: string
          status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
          waha_message_id: string | null
          error_message: string | null
          sent_at: string | null
          delivered_at: string | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          contact_id: string
          phone: string
          message_content: string
          status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
          waha_message_id?: string | null
          error_message?: string | null
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          contact_id?: string
          phone?: string
          message_content?: string
          status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
          waha_message_id?: string | null
          error_message?: string | null
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
          created_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          user_id: string
          connection_id: string
          chat_id: string
          waha_message_id: string
          content: string
          media_url: string | null
          media_type: string | null
          from_me: boolean
          timestamp: string
          ack: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          connection_id: string
          chat_id: string
          waha_message_id: string
          content: string
          media_url?: string | null
          media_type?: string | null
          from_me: boolean
          timestamp: string
          ack?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          connection_id?: string
          chat_id?: string
          waha_message_id?: string
          content?: string
          media_url?: string | null
          media_type?: string | null
          from_me?: boolean
          timestamp?: string
          ack?: number
          created_at?: string
        }
      }
      scheduled_messages: {
        Row: {
          id: string
          user_id: string
          connection_id: string
          chat_id: string
          content: string
          media_url: string | null
          media_type: string | null
          scheduled_at: string
          status: 'pending' | 'sent' | 'failed' | 'cancelled'
          sent_at: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          connection_id: string
          chat_id: string
          content: string
          media_url?: string | null
          media_type?: string | null
          scheduled_at: string
          status?: 'pending' | 'sent' | 'failed' | 'cancelled'
          sent_at?: string | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          connection_id?: string
          chat_id?: string
          content?: string
          media_url?: string | null
          media_type?: string | null
          scheduled_at?: string
          status?: 'pending' | 'sent' | 'failed' | 'cancelled'
          sent_at?: string | null
          error_message?: string | null
          created_at?: string
        }
      }
      blacklist: {
        Row: {
          id: string
          user_id: string
          phone: string
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          phone: string
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          phone?: string
          reason?: string | null
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: 'message' | 'campaign' | 'connection' | 'system' | 'alert'
          title: string
          description: string | null
          action_url: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'message' | 'campaign' | 'connection' | 'system' | 'alert'
          title: string
          description?: string | null
          action_url?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'message' | 'campaign' | 'connection' | 'system' | 'alert'
          title?: string
          description?: string | null
          action_url?: string | null
          is_read?: boolean
          created_at?: string
        }
      }
      support_tickets: {
        Row: {
          id: string
          user_id: string
          subject: string
          description: string
          category: 'technical' | 'billing' | 'feature' | 'other'
          priority: 'low' | 'medium' | 'high' | 'urgent'
          status: 'open' | 'in_progress' | 'resolved' | 'closed'
          attachments: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subject: string
          description: string
          category: 'technical' | 'billing' | 'feature' | 'other'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          status?: 'open' | 'in_progress' | 'resolved' | 'closed'
          attachments?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subject?: string
          description?: string
          category?: 'technical' | 'billing' | 'feature' | 'other'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          status?: 'open' | 'in_progress' | 'resolved' | 'closed'
          attachments?: string[] | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
