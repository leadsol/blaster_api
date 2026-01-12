'use client'

import { useState, useEffect } from 'react'
import {
  Bell,
  Check,
  CheckCheck,
  MessageSquare,
  Users,
  Zap,
  AlertCircle,
  Settings,
  Trash2,
  Filter,
  MoreVertical,
  Loader2
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

interface Notification {
  id: string
  type: 'message' | 'campaign' | 'connection' | 'system' | 'alert'
  title: string
  description: string | null
  action_url: string | null
  is_read: boolean
  created_at: string
}

// Helper to format relative time in Hebrew
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMinutes < 1) return 'עכשיו'
  if (diffMinutes < 60) return `לפני ${diffMinutes} דקות`
  if (diffHours < 24) return `לפני ${diffHours} שעות`
  if (diffDays === 1) return 'אתמול'
  if (diffDays < 7) return `לפני ${diffDays} ימים`
  return date.toLocaleDateString('he-IL')
}

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'message':
      return <MessageSquare className="w-5 h-5 text-blue-500" />
    case 'campaign':
      return <Zap className="w-5 h-5 text-purple-500" />
    case 'connection':
      return <Users className="w-5 h-5 text-green-500" />
    case 'alert':
      return <AlertCircle className="w-5 h-5 text-orange-500" />
    case 'system':
      return <Settings className="w-5 h-5 text-gray-500" />
    default:
      return <Bell className="w-5 h-5 text-gray-500" />
  }
}

const getNotificationBg = (type: Notification['type'], darkMode: boolean) => {
  switch (type) {
    case 'message':
      return darkMode ? 'bg-blue-500/20' : 'bg-blue-100'
    case 'campaign':
      return darkMode ? 'bg-purple-500/20' : 'bg-purple-100'
    case 'connection':
      return darkMode ? 'bg-green-500/20' : 'bg-green-100'
    case 'alert':
      return darkMode ? 'bg-orange-500/20' : 'bg-orange-100'
    case 'system':
      return darkMode ? 'bg-gray-500/20' : 'bg-gray-100'
    default:
      return darkMode ? 'bg-gray-500/20' : 'bg-gray-100'
  }
}

export default function NotificationsPage() {
  const { darkMode } = useTheme()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [selectedType, setSelectedType] = useState<string>('all')

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread' && n.is_read) return false
    if (selectedType !== 'all' && n.type !== selectedType) return false
    return true
  })

  const markAsRead = async (id: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] })
      })
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, is_read: true } : n)
        )
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true })
      })
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, is_read: true }))
        )
      }
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications?id=${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id))
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  const clearAll = async () => {
    try {
      const response = await fetch('/api/notifications?all=true', {
        method: 'DELETE'
      })
      if (response.ok) {
        setNotifications([])
      }
    } catch (error) {
      console.error('Error clearing notifications:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[#0043E0]" />
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 h-full overflow-y-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className={`text-lg sm:text-xl lg:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
            <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
            התראות
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs sm:text-sm px-1.5 sm:px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-1 text-xs sm:text-sm`}>עקוב אחר כל העדכונים וההתראות שלך</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 ${darkMode ? 'text-[#0043E0] hover:bg-[#0043E0]/10' : 'text-[#1e3a5f] hover:bg-[#1e3a5f]/5'} rounded-lg transition-colors text-xs sm:text-sm`}
            >
              <CheckCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">סמן הכל כנקרא</span>
              <span className="sm:hidden">נקרא</span>
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 text-red-500 ${darkMode ? 'hover:bg-red-500/10' : 'hover:bg-red-50'} rounded-lg transition-colors text-xs sm:text-sm`}
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">נקה הכל</span>
              <span className="sm:hidden">נקה</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className={`${darkMode ? 'bg-[#142241] border-[#1e3a5f]' : 'bg-white border-gray-200'} rounded-lg sm:rounded-xl border p-3 sm:p-4 mb-4 sm:mb-6`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`} />
            <span className={`text-xs sm:text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>סנן לפי:</span>
          </div>

          {/* Read/Unread Filter */}
          <div className={`flex ${darkMode ? 'bg-[#1a2d4a]' : 'bg-gray-100'} rounded-lg p-1`}>
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                filter === 'all'
                  ? darkMode ? 'bg-[#0043E0] text-white' : 'bg-white text-gray-900 shadow-sm'
                  : darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              הכל ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-2.5 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                filter === 'unread'
                  ? darkMode ? 'bg-[#0043E0] text-white' : 'bg-white text-gray-900 shadow-sm'
                  : darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              לא נקראו ({unreadCount})
            </button>
          </div>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className={`px-2.5 sm:px-4 py-1.5 sm:py-2 border rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-[#0043E0] focus:border-transparent outline-none ${
              darkMode ? 'bg-[#1a2d4a] border-[#2a3f5f] text-white' : 'border-gray-200 text-gray-900'
            }`}
          >
            <option value="all">כל הסוגים</option>
            <option value="message">הודעות</option>
            <option value="campaign">קמפיינים</option>
            <option value="connection">חיבורים</option>
            <option value="alert">התראות</option>
            <option value="system">מערכת</option>
          </select>
        </div>
      </div>

      {/* Notifications List */}
      <div className={`${darkMode ? 'bg-[#142241] border-[#1e3a5f]' : 'bg-white border-gray-200'} rounded-lg sm:rounded-xl border overflow-hidden`}>
        {filteredNotifications.length === 0 ? (
          <div className="p-6 sm:p-8 lg:p-12 text-center">
            <div className={`w-12 h-12 sm:w-16 sm:h-16 ${darkMode ? 'bg-[#1a2d4a]' : 'bg-gray-100'} rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4`}>
              <Bell className={`w-6 h-6 sm:w-8 sm:h-8 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            </div>
            <h3 className={`text-base sm:text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'} mb-2`}>אין התראות</h3>
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-xs sm:text-sm`}>
              {filter === 'unread'
                ? 'אין התראות שלא נקראו'
                : 'כל ההתראות שלך יופיעו כאן'}
            </p>
          </div>
        ) : (
          <div className={`divide-y ${darkMode ? 'divide-[#1e3a5f]' : 'divide-gray-100'}`}>
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 sm:p-4 transition-colors ${
                  !notification.is_read
                    ? darkMode ? 'bg-[#0043E0]/10' : 'bg-blue-50/50'
                    : darkMode ? 'hover:bg-[#1a2d4a]' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-2.5 sm:gap-4">
                  {/* Icon */}
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getNotificationBg(notification.type, darkMode)}`}>
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-medium text-sm sm:text-base ${!notification.is_read ? (darkMode ? 'text-white' : 'text-gray-900') : (darkMode ? 'text-gray-300' : 'text-gray-700')}`}>
                          {notification.title}
                        </h3>
                        {notification.description && (
                          <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5 line-clamp-2`}>
                            {notification.description}
                          </p>
                        )}
                        <span className={`text-[10px] sm:text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'} mt-1 block`}>
                          {formatRelativeTime(notification.created_at)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-[#0043E0] rounded-full"></div>
                        )}
                        <div className="relative group">
                          <button className={`p-1 sm:p-1.5 ${darkMode ? 'hover:bg-[#243a5a]' : 'hover:bg-gray-200'} rounded-lg transition-colors`}>
                            <MoreVertical className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                          </button>
                          <div className={`absolute left-0 top-full mt-1 ${darkMode ? 'bg-[#1a2d4a] border-[#2a3f5f]' : 'bg-white border-gray-200'} border rounded-lg shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[120px] sm:min-w-[140px]`}>
                            {!notification.is_read && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm ${darkMode ? 'text-gray-300 hover:bg-[#243a5a]' : 'text-gray-700 hover:bg-gray-50'} flex items-center gap-2`}
                              >
                                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                סמן כנקרא
                              </button>
                            )}
                            {notification.action_url && (
                              <a
                                href={notification.action_url}
                                className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm ${darkMode ? 'text-gray-300 hover:bg-[#243a5a]' : 'text-gray-700 hover:bg-gray-50'} flex items-center gap-2`}
                              >
                                <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                עבור לפעולה
                              </a>
                            )}
                            <button
                              onClick={() => deleteNotification(notification.id)}
                              className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-red-500 ${darkMode ? 'hover:bg-red-500/10' : 'hover:bg-red-50'} flex items-center gap-2`}
                            >
                              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              מחק
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notification Settings Link */}
      <div className="mt-4 sm:mt-6 text-center">
        <a
          href="/profile?tab=settings"
          className={`text-xs sm:text-sm ${darkMode ? 'text-[#0043E0]' : 'text-[#1e3a5f]'} hover:underline flex items-center justify-center gap-1.5 sm:gap-2`}
        >
          <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          הגדרות התראות
        </a>
      </div>
    </div>
  )
}
