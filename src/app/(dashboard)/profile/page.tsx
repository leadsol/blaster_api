'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, CreditCard, FileText, Clock, Check, X, Edit2, Camera, Save } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  company_name: string | null
  phone: string | null
}

interface ActivityLog {
  id: string
  action: string
  description: string
  date: string
  time: string
  status: 'success' | 'failed' | 'pending'
}

interface Invoice {
  id: string
  date: string
  amount: string
  status: 'paid' | 'pending' | 'failed'
  description: string
}

const mockActivityLogs: ActivityLog[] = [
  { id: '1', action: 'קמפיין נשלח', description: 'קמפיין מבצע חורף - הושלם בהצלחה', date: '06/07/2025', time: '12:00', status: 'success' },
  { id: '2', action: 'קמפיין נשלח', description: 'קמפיין וחכר חודשי - הושלם VIP', date: '06/07/2025', time: '09:30', status: 'success' },
  { id: '3', action: 'הודעות נכשלו', description: 'קמפיין וחכר חודשי - תקלות תקשורת', date: '28/06/2025', time: '14:45', status: 'failed' },
  { id: '4', action: 'הגדרות שונו', description: 'עדכון פרופיל - החלפת סיסמה', date: '26/06/2025', time: '06:15', status: 'success' },
  { id: '5', action: 'הודעות תוזמנו', description: 'תזמון קמפיין לתאריך 10/04/2025', date: '24/06/2025', time: '17:00', status: 'pending' },
  { id: '6', action: 'קמפיין נשלח', description: 'קמפיין חג שמח', date: '10/04/2025', time: '11:30', status: 'success' },
  { id: '7', action: 'קמפיין נשלח', description: 'קמפיין הזמנה לאירוע', date: '10/04/2025', time: '15:10', status: 'success' },
  { id: '8', action: 'הודעות נכשלו', description: 'קמפיין מכירות - מכסה חרגה', date: '18/04/2025', time: '07:50', status: 'failed' },
  { id: '9', action: 'הודעות תוזמנו', description: 'תזכורת פגישה בזום', date: '15/04/2025', time: '19:40', status: 'pending' },
]

const mockInvoices: Invoice[] = [
  { id: '1', date: '01/07/2025', amount: '199 ₪', status: 'paid', description: 'חבילה מקצועית - יולי 2025' },
  { id: '2', date: '01/06/2025', amount: '199 ₪', status: 'paid', description: 'חבילה מקצועית - יוני 2025' },
  { id: '3', date: '01/05/2025', amount: '199 ₪', status: 'paid', description: 'חבילה מקצועית - מאי 2025' },
  { id: '4', date: '01/04/2025', amount: '99 ₪', status: 'paid', description: 'חבילה בסיסית - אפריל 2025' },
]

export default function ProfilePage() {
  const { darkMode } = useTheme()
  const [activeTab, setActiveTab] = useState<'details' | 'activity' | 'billing' | 'invoices'>('details')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) setProfile(data)
    }
    setLoading(false)
  }

  const tabs = [
    { id: 'details', label: 'פרטי משתמש', icon: User },
    { id: 'billing', label: 'חבילה וחשבונית', icon: CreditCard },
    { id: 'invoices', label: 'היסטוריית פעולות', icon: FileText },
    { id: 'activity', label: 'הגדרות שלך', icon: Clock },
  ]

  return (
    <div className="p-3 sm:p-4 lg:p-6 h-full overflow-y-auto" dir="rtl">
      {/* Header */}
      <div className="text-center mb-4 sm:mb-6 lg:mb-8">
        <h1 className={`text-lg sm:text-xl lg:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>הפרופיל שלך</h1>
      </div>

      {/* Tabs */}
      <div className="flex justify-start lg:justify-center gap-1 sm:gap-2 mb-4 sm:mb-6 lg:mb-8 overflow-x-auto pb-2 lg:pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap flex-shrink-0 ${
              activeTab === tab.id
                ? 'bg-[#25D366] text-white'
                : darkMode ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Left - Profile Status */}
        <div className="lg:col-span-3 space-y-4 lg:space-y-6 order-2 lg:order-1">
          {/* Profile Completion */}
          <div className={`${darkMode ? 'bg-white/5' : 'bg-white border border-gray-200'} rounded-lg sm:rounded-xl p-4 sm:p-6`}>
            <h3 className={`font-medium mb-3 sm:mb-4 ${darkMode ? 'text-white' : 'text-gray-900'} text-sm sm:text-base`}>סטטוס הפרופיל שלך</h3>
            <div className="flex items-center justify-center mb-3 sm:mb-4">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke={darkMode ? '#1e3a5f' : '#e5e7eb'} strokeWidth="10" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#25D366" strokeWidth="10" strokeDasharray="168 251" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-xl sm:text-2xl lg:text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>2/3</span>
                  <span className={`text-[8px] sm:text-[10px] lg:text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>הושלמו</span>
                </div>
              </div>
            </div>
            <button className="w-full py-2 sm:py-2.5 bg-[#25D366] text-white rounded-lg hover:bg-[#20bd5a] transition-colors text-xs sm:text-sm">
              השלם פרופיל
            </button>
          </div>

          {/* Stats */}
          <div className={`${darkMode ? 'bg-white/5' : 'bg-white border border-gray-200'} rounded-lg sm:rounded-xl p-4 sm:p-6 hidden lg:block`}>
            <h3 className={`font-medium mb-3 sm:mb-4 ${darkMode ? 'text-white' : 'text-gray-900'} text-sm sm:text-base`}>סטטוס ביצועים</h3>
            <div className="flex flex-wrap gap-1 sm:gap-2 mb-3 sm:mb-4">
              <button className="px-2 sm:px-3 py-1 bg-[#25D366] text-white text-[10px] sm:text-xs rounded-full">היום</button>
              <button className={`px-2 sm:px-3 py-1 ${darkMode ? 'bg-white/10 text-gray-400' : 'bg-gray-100 text-gray-600'} text-[10px] sm:text-xs rounded-full`}>שבוע</button>
              <button className={`px-2 sm:px-3 py-1 ${darkMode ? 'bg-white/10 text-gray-400' : 'bg-gray-100 text-gray-600'} text-[10px] sm:text-xs rounded-full`}>חודש</button>
              <button className={`px-2 sm:px-3 py-1 ${darkMode ? 'bg-white/10 text-gray-400' : 'bg-gray-100 text-gray-600'} text-[10px] sm:text-xs rounded-full`}>שנה</button>
            </div>
            <p className={`text-xs sm:text-sm mb-3 sm:mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>תאריך סיכום אחרון: היום 1 בנו׳</p>
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[#25D366] rounded-full" />
                <span className={`text-xs sm:text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>49 הקמפיינים הפעם</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className={`text-xs sm:text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>843 הודעות שמחקתי</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                <span className={`text-xs sm:text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>13 הודעות להקיטעה ביטול</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span className={`text-xs sm:text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>2 הודעות שנכשלו</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right - Content */}
        <div className="lg:col-span-9 order-1 lg:order-2">
          {activeTab === 'details' && (
            <div className={`${darkMode ? 'bg-white/5' : 'bg-white border border-gray-200'} rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-6`}>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 mb-6 sm:mb-8">
                <div className="relative flex-shrink-0">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center overflow-hidden">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl sm:text-2xl lg:text-3xl text-white font-medium">
                        {profile?.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
                      </span>
                    )}
                  </div>
                  <button className="absolute bottom-0 right-0 w-6 h-6 sm:w-8 sm:h-8 bg-[#25D366] rounded-full flex items-center justify-center">
                    <Camera className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </button>
                </div>
                <div className="flex-1 text-center sm:text-right">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 mb-2">
                    <span className="px-2 sm:px-3 py-1 bg-red-500/20 text-red-400 text-[10px] sm:text-xs rounded-full">האימות האחרון היום</span>
                    <span className="px-2 sm:px-3 py-1 bg-green-500/20 text-green-400 text-[10px] sm:text-xs rounded-full">אימות אחזקה בהצלחה</span>
                  </div>
                  <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} hidden sm:block`}>
                    אימייל מאומתהצרה סרת 11 מקספי 30 שתאות לחותמה.<br />
                    הקמפיין הבא ללא פר בלק פ סגס לדבר
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <h4 className={`font-medium mb-2 sm:mb-4 ${darkMode ? 'text-white' : 'text-gray-900'} text-sm sm:text-base`}>פרטים אישיים</h4>
                  <p className={`text-xs sm:text-sm mb-3 sm:mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>עדכן את פרטי הפרופיל שלך כאן</p>
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className={`block text-xs sm:text-sm mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>שם מלא</label>
                      <input
                        type="text"
                        defaultValue={profile?.full_name || ''}
                        className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 ${darkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#25D366] text-sm sm:text-base`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs sm:text-sm mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>טלפון</label>
                      <input
                        type="tel"
                        defaultValue={profile?.phone || '054-0000000'}
                        className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 ${darkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none text-sm sm:text-base`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs sm:text-sm mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>סטטוס</label>
                      <div className="flex items-center gap-2">
                        <span className="px-2 sm:px-3 py-1 bg-green-500/20 text-green-400 text-xs sm:text-sm rounded">פעיל</span>
                        <span className={`px-2 sm:px-3 py-1 ${darkMode ? 'bg-white/10 text-gray-400' : 'bg-gray-100 text-gray-500'} text-xs sm:text-sm rounded`}>לא פעיל</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className={`font-medium mb-2 sm:mb-4 ${darkMode ? 'text-white' : 'text-gray-900'} text-sm sm:text-base`}>פרטים לחשבונית</h4>
                  <p className={`text-xs sm:text-sm mb-3 sm:mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>פרטי חברה / עוסק מורשה לקבלות ומסמכים</p>
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className={`block text-xs sm:text-sm mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>אימייל</label>
                      <input
                        type="email"
                        defaultValue={profile?.email || 'ahoneman@gmail.com'}
                        className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 ${darkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none text-sm sm:text-base`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs sm:text-sm mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>שם עסק בור עולם לי *</label>
                      <input
                        type="text"
                        className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 ${darkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded-lg focus:outline-none text-sm sm:text-base`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button className="mt-4 sm:mt-6 px-4 sm:px-6 py-2 sm:py-2.5 bg-[#25D366] text-white rounded-lg hover:bg-[#20bd5a] transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm w-full sm:w-auto">
                <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                שמור שינו חדש
              </button>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className={`${darkMode ? 'bg-white/5' : 'bg-white border border-gray-200'} rounded-lg sm:rounded-xl overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className={darkMode ? 'bg-white/5' : 'bg-gray-50'}>
                    <tr className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      <th className="text-right p-2 sm:p-3 lg:p-4">תאריך</th>
                      <th className="text-right p-2 sm:p-3 lg:p-4">שעה</th>
                      <th className="text-right p-2 sm:p-3 lg:p-4">סוג פעולה</th>
                      <th className="text-right p-2 sm:p-3 lg:p-4">תיאור / פעולה</th>
                      <th className="text-right p-2 sm:p-3 lg:p-4">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockActivityLogs.map((log) => (
                      <tr key={log.id} className={`border-t ${darkMode ? 'border-white/5' : 'border-gray-100'}`}>
                        <td className={`p-2 sm:p-3 lg:p-4 ${darkMode ? 'text-white' : 'text-gray-900'} text-xs sm:text-sm`}>{log.date}</td>
                        <td className={`p-2 sm:p-3 lg:p-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'} text-xs sm:text-sm`}>{log.time}</td>
                        <td className="p-2 sm:p-3 lg:p-4">
                          <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs ${
                            log.status === 'success' ? 'bg-green-500/20 text-green-400' :
                            log.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className={`p-2 sm:p-3 lg:p-4 text-xs sm:text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{log.description}</td>
                        <td className="p-2 sm:p-3 lg:p-4">
                          {log.status === 'success' ? (
                            <span className="flex items-center gap-1 text-green-400 text-[10px] sm:text-xs"><Check className="w-3 h-3 sm:w-4 sm:h-4" /> הצלחה</span>
                          ) : log.status === 'failed' ? (
                            <span className="flex items-center gap-1 text-red-400 text-[10px] sm:text-xs"><X className="w-3 h-3 sm:w-4 sm:h-4" /> נכשל</span>
                          ) : (
                            <span className="flex items-center gap-1 text-yellow-400 text-[10px] sm:text-xs"><Clock className="w-3 h-3 sm:w-4 sm:h-4" /> ממתין</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className={`${darkMode ? 'bg-white/5' : 'bg-white border border-gray-200'} rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-6`}>
              <h3 className={`font-medium mb-4 sm:mb-6 ${darkMode ? 'text-white' : 'text-gray-900'} text-sm sm:text-base`}>החבילה הנוכחית שלך</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div className={`${darkMode ? 'bg-white/5' : 'bg-gray-50'} rounded-lg sm:rounded-xl p-3 sm:p-4 border border-[#25D366]`}>
                  <h4 className="text-[#25D366] font-medium mb-1 sm:mb-2 text-sm sm:text-base">חבילה מקצועית</h4>
                  <p className={`text-xl sm:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>199 ₪<span className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>/חודש</span></p>
                  <ul className={`space-y-1.5 sm:space-y-2 text-xs sm:text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    <li className="flex items-center gap-1.5 sm:gap-2"><Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#25D366]" /> עד 5,000 הודעות</li>
                    <li className="flex items-center gap-1.5 sm:gap-2"><Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#25D366]" /> 3 חיבורים</li>
                    <li className="flex items-center gap-1.5 sm:gap-2"><Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#25D366]" /> אנליטיקס מתקדם</li>
                  </ul>
                </div>
                <div className={`${darkMode ? 'bg-white/5' : 'bg-gray-50'} rounded-lg sm:rounded-xl p-3 sm:p-4`}>
                  <h4 className={`font-medium mb-1 sm:mb-2 ${darkMode ? 'text-white' : 'text-gray-900'} text-sm sm:text-base`}>חבילה עסקית</h4>
                  <p className={`text-xl sm:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>399 ₪<span className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>/חודש</span></p>
                  <ul className={`space-y-1.5 sm:space-y-2 text-xs sm:text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    <li className="flex items-center gap-1.5 sm:gap-2"><Check className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`} /> הודעות ללא הגבלה</li>
                    <li className="flex items-center gap-1.5 sm:gap-2"><Check className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`} /> חיבורים ללא הגבלה</li>
                    <li className="flex items-center gap-1.5 sm:gap-2"><Check className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`} /> כל הפיצ'רים</li>
                  </ul>
                  <button className="w-full mt-3 sm:mt-4 py-1.5 sm:py-2 border border-[#25D366] text-[#25D366] rounded-lg hover:bg-[#25D366]/10 text-xs sm:text-sm">
                    שדרג עכשיו
                  </button>
                </div>
              </div>

              <h3 className={`font-medium mb-3 sm:mb-4 ${darkMode ? 'text-white' : 'text-gray-900'} text-sm sm:text-base`}>אמצעי תשלום</h3>
              <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 ${darkMode ? 'bg-white/5' : 'bg-gray-50'} rounded-lg`}>
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-6 sm:w-12 sm:h-8 bg-blue-600 rounded flex items-center justify-center text-white text-[10px] sm:text-xs">VISA</div>
                  <div>
                    <p className={`${darkMode ? 'text-white' : 'text-gray-900'} text-sm sm:text-base`}>•••• •••• •••• 4242</p>
                    <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>תוקף: 12/26</p>
                  </div>
                </div>
                <button className="sm:mr-auto text-[#25D366] text-xs sm:text-sm hover:underline">עדכן</button>
              </div>
            </div>
          )}

          {activeTab === 'invoices' && (
            <div className={`${darkMode ? 'bg-white/5' : 'bg-white border border-gray-200'} rounded-lg sm:rounded-xl overflow-hidden`}>
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead className={darkMode ? 'bg-white/5' : 'bg-gray-50'}>
                    <tr className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      <th className="text-right p-2 sm:p-3 lg:p-4">תאריך</th>
                      <th className="text-right p-2 sm:p-3 lg:p-4">תיאור</th>
                      <th className="text-right p-2 sm:p-3 lg:p-4">סכום</th>
                      <th className="text-right p-2 sm:p-3 lg:p-4">סטטוס</th>
                      <th className="text-right p-2 sm:p-3 lg:p-4">פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockInvoices.map((invoice) => (
                      <tr key={invoice.id} className={`border-t ${darkMode ? 'border-white/5' : 'border-gray-100'}`}>
                        <td className={`p-2 sm:p-3 lg:p-4 ${darkMode ? 'text-white' : 'text-gray-900'} text-xs sm:text-sm`}>{invoice.date}</td>
                        <td className={`p-2 sm:p-3 lg:p-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'} text-xs sm:text-sm`}>{invoice.description}</td>
                        <td className={`p-2 sm:p-3 lg:p-4 font-medium ${darkMode ? 'text-white' : 'text-gray-900'} text-xs sm:text-sm`}>{invoice.amount}</td>
                        <td className="p-2 sm:p-3 lg:p-4">
                          <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs ${
                            invoice.status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {invoice.status === 'paid' ? 'שולם' : 'ממתין'}
                          </span>
                        </td>
                        <td className="p-2 sm:p-3 lg:p-4">
                          <button className="text-[#25D366] text-xs sm:text-sm hover:underline">הורד PDF</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="sm:hidden divide-y divide-gray-100 dark:divide-white/5">
                {mockInvoices.map((invoice) => (
                  <div key={invoice.id} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{invoice.date}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        invoice.status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {invoice.status === 'paid' ? 'שולם' : 'ממתין'}
                      </span>
                    </div>
                    <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'} mb-1`}>{invoice.description}</p>
                    <div className="flex items-center justify-between">
                      <span className={`font-medium text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{invoice.amount}</span>
                      <button className="text-[#25D366] text-xs hover:underline">הורד PDF</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
