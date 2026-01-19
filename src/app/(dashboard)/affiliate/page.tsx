'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Users,
  DollarSign,
  Copy,
  Check,
  TrendingUp,
  ChevronDown,
  Wallet,
  CreditCard,
  BarChart3,
  HelpCircle
} from 'lucide-react'

interface WithdrawalHistory {
  id: string
  date: string
  amount: number
  status: 'pending' | 'completed' | 'rejected'
  method: string
}

interface AffiliateStats {
  totalEarnings: number
  pendingEarnings: number
  availableToWithdraw: number
  referralCount: number
  conversionCount: number
  conversionRate: number
}

interface MonthlyData {
  month: string
  amount: number
}

// FAQ items - static content is acceptable
const faqItems = [
  {
    question: 'איך מחושבות העמלות?',
    answer: 'העמלות מחושבות באופן אוטומטי בכל פעם שמישהו נרשם דרך הלינק שלך ומשלם על חבילה. תקבל 20% מכל תשלום ראשון.',
  },
  {
    question: 'מתי אפשר למשוך עמלות?',
    answer: 'ניתן למשוך עמלות החל מסכום מינימלי של 100₪. המשיכה מתבצעת תוך 5-7 ימי עסקים.',
  },
  {
    question: 'האם יש הגבלה על כמות הפניות?',
    answer: 'לא! אין הגבלה. ככל שתפנה יותר אנשים, כך תרוויח יותר.',
  },
  {
    question: 'מה קורה אם המשיכה לא אושרה?',
    answer: 'אם יש בעיה עם משיכה, צוות התמיכה שלנו יצור איתך קשר להסדרת העניין.',
  },
]

export default function AffiliatePage() {
  const [copied, setCopied] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [selectedFaq, setSelectedFaq] = useState<number | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Reserved for withdrawal history feature
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalHistory[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Reserved for monthly data chart feature
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Reserved for affiliate stats feature
  const [stats, setStats] = useState<AffiliateStats>({
    totalEarnings: 0,
    pendingEarnings: 0,
    availableToWithdraw: 0,
    referralCount: 0,
    conversionCount: 0,
    conversionRate: 0
  })
  const [affiliateLink, setAffiliateLink] = useState('')
  const [couponCode, setCouponCode] = useState('')

  const loadAffiliateData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Load affiliate profile/settings
    const { data: profile } = await supabase
      .from('profiles')
      .select('affiliate_code, affiliate_coupon')
      .eq('id', user.id)
      .single()

    if (profile) {
      // Generate affiliate link from user's affiliate code
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
      setAffiliateLink(profile.affiliate_code ? `${baseUrl}/ref/${profile.affiliate_code}` : '')
      setCouponCode(profile.affiliate_coupon || '')
    }

    // Note: Affiliate stats, withdrawal history, and monthly data would come from
    // affiliate-related tables when the affiliate system is fully implemented.
    // For now, show zeros/empty states until the feature is built out.
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial data fetch on mount
    loadAffiliateData()
  }, [])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const maxAmount = monthlyData.length > 0 ? Math.max(...monthlyData.map(d => d.amount)) : 1

  return (
    <div className="p-3 sm:p-4 lg:p-6 h-full overflow-y-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6 lg:mb-8">
        <div>
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">תוכנית השותפים שלנו</h1>
          <p className="text-xs sm:text-sm text-gray-500">הרוויח עמלות על כל לקוח שתפנה אלינו</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Left Column - Stats & Chart */}
        <div className="lg:col-span-8 order-2 lg:order-1">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </div>
                <span className="text-[10px] sm:text-xs text-gray-500">סה&quot;כ</span>
              </div>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">${stats.totalEarnings.toLocaleString()}</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">עמלות שהורווחו</p>
            </div>

            <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
                </div>
                <span className="text-[10px] sm:text-xs text-gray-500">ממתין</span>
              </div>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">${stats.pendingEarnings}</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">בהמתנה לאישור</p>
            </div>

            <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <span className="text-[10px] sm:text-xs text-gray-500">זמין</span>
              </div>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">${stats.availableToWithdraw.toLocaleString()}</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">למשיכה</p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-4 sm:mb-6">
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">פילוח משיכת עמלות לפי חודשים</h3>
              <select className="px-2 sm:px-3 py-1 sm:py-1.5 border border-gray-200 rounded-lg text-xs sm:text-sm">
                <option>2025</option>
                <option>2024</option>
              </select>
            </div>

            <div className="flex items-end gap-1 sm:gap-2 h-32 sm:h-40 lg:h-48 overflow-x-auto">
              {monthlyData.length > 0 ? monthlyData.map((data, index) => (
                <div key={index} className="flex-1 min-w-[20px] sm:min-w-[30px] flex flex-col items-center">
                  <div
                    className="w-full bg-[#1e3a5f] rounded-t-sm transition-all hover:bg-[#2a4a73]"
                    style={{ height: `${(data.amount / maxAmount) * 100}%` }}
                  />
                  <span className="text-[8px] sm:text-[10px] lg:text-xs text-gray-500 mt-1 sm:mt-2 transform -rotate-45 origin-top-right whitespace-nowrap">
                    {data.month}
                  </span>
                </div>
              )) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                  אין נתונים להצגה
                </div>
              )}
            </div>
          </div>

          {/* Withdrawal History */}
          <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">היסטוריית משיכת עמלות</h3>
              <select className="px-2 sm:px-3 py-1 sm:py-1.5 border border-gray-200 rounded-lg text-xs sm:text-sm">
                <option>סנן לפי סטטוס</option>
                <option>הושלם</option>
                <option>ממתין</option>
                <option>נדחה</option>
              </select>
            </div>
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead className="bg-gray-50">
                  <tr className="text-gray-600 text-xs sm:text-sm">
                    <th className="text-right p-3 sm:p-4 font-medium">תאריך בקשת המשיכה</th>
                    <th className="text-right p-3 sm:p-4 font-medium">סכום למשיכה</th>
                    <th className="text-right p-3 sm:p-4 font-medium">סטטוס</th>
                    <th className="text-right p-3 sm:p-4 font-medium">אמצעי תשלום</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawalHistory.length > 0 ? withdrawalHistory.map((item) => (
                    <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="p-3 sm:p-4 text-gray-900 text-xs sm:text-sm">{item.date}</td>
                      <td className="p-3 sm:p-4 text-gray-900 text-xs sm:text-sm">${item.amount}</td>
                      <td className="p-3 sm:p-4">
                        <span className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                          item.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : item.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {item.status === 'completed' ? 'הושלם' : item.status === 'pending' ? 'ממתין' : 'נדחה'}
                        </span>
                      </td>
                      <td className="p-3 sm:p-4 text-gray-600 text-xs sm:text-sm">{item.method}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-500 text-sm">
                        אין היסטוריית משיכות
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Mobile Cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {withdrawalHistory.length > 0 ? withdrawalHistory.map((item) => (
                <div key={item.id} className="p-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-900 text-sm font-medium">${item.amount}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      item.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : item.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {item.status === 'completed' ? 'הושלם' : item.status === 'pending' ? 'ממתין' : 'נדחה'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{item.date}</span>
                    <span>{item.method}</span>
                  </div>
                </div>
              )) : (
                <div className="p-8 text-center text-gray-500 text-sm">
                  אין היסטוריית משיכות
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Affiliate Info */}
        <div className="lg:col-span-4 order-1 lg:order-2 space-y-3 sm:space-y-4 lg:space-y-6">
          {/* Balance Card */}
          <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2a4a73] rounded-lg sm:rounded-xl p-4 sm:p-6 text-white">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <span className="text-white/80 text-xs sm:text-sm">סטטוס העמלות שלך</span>
              <div className="w-12 h-12 sm:w-16 sm:h-16 relative">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50" cy="50" r="40"
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50" cy="50" r="40"
                    fill="none"
                    stroke="#25D366"
                    strokeWidth="8"
                    strokeDasharray={`${stats.totalEarnings > 0 ? (stats.availableToWithdraw / stats.totalEarnings) * 251 : 0} 251`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] sm:text-xs font-medium">0$</span>
                </div>
              </div>
            </div>
            <p className="text-white/60 text-xs sm:text-sm mb-2">יתרה למשיכה</p>
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="w-full py-2 sm:py-3 bg-[#25D366] text-white rounded-lg font-medium hover:bg-[#20bd5a] transition-colors mt-2 sm:mt-4 text-xs sm:text-sm"
            >
              שלח בקשה למשוך את העמלה
            </button>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-4 sm:p-6">
            <h3 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">סטיסטיקות</h3>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  משתמשים שהופנו
                </span>
                <span className="font-semibold text-gray-900 text-sm sm:text-base">{stats.referralCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                  <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  המרות ששילמו
                </span>
                <span className="font-semibold text-gray-900 text-sm sm:text-base">{stats.conversionCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                  <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  % המרה
                </span>
                <span className="font-semibold text-green-600 text-sm sm:text-base">{stats.conversionRate}%</span>
              </div>
            </div>
          </div>

          {/* Affiliate Link */}
          <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-4 sm:p-6">
            <h3 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">לינק האפליאציה שלך</h3>
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <input
                type="text"
                readOnly
                value={affiliateLink}
                className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs sm:text-sm text-gray-600"
                dir="ltr"
              />
              <button
                onClick={() => copyToClipboard(affiliateLink)}
                className="p-1.5 sm:p-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#2a4a73] transition-colors"
              >
                {copied ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : <Copy className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
            </div>

            <h4 className="font-medium text-gray-900 mb-2 text-xs sm:text-sm">קוד הקופון שלך</h4>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs sm:text-sm font-mono text-yellow-800">
                {couponCode}
              </div>
              <button
                onClick={() => copyToClipboard(couponCode)}
                className="p-1.5 sm:p-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
              >
                <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {/* FAQ */}
          <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-4 sm:p-6">
            <h3 className="font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base">
              <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              שאלות נפוצות
            </h3>
            <div className="space-y-2">
              {faqItems.map((item, index) => (
                <div key={index} className="border border-gray-100 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setSelectedFaq(selectedFaq === index ? null : index)}
                    className="w-full p-2.5 sm:p-3 text-right text-xs sm:text-sm font-medium text-gray-900 hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span className="line-clamp-2">{item.question}</span>
                    <ChevronDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform flex-shrink-0 ${selectedFaq === index ? 'rotate-180' : ''}`} />
                  </button>
                  {selectedFaq === index && (
                    <div className="px-2.5 sm:px-3 pb-2.5 sm:pb-3 text-xs sm:text-sm text-gray-600">
                      {item.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-[#1e3a5f] rounded-lg sm:rounded-xl w-full max-w-[400px] p-4 sm:p-6 text-white max-h-[90vh] overflow-y-auto" dir="rtl">
            <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">משיכת עמלות לחשבון שהוזן</h3>
            <p className="text-white/60 text-xs sm:text-sm mb-4 sm:mb-6">הכנס סכום למשיכה. סכום מינימלי: 100$</p>

            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm text-white/80 mb-1.5 sm:mb-2">סכום</label>
                <input
                  type="number"
                  placeholder="0.00"
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-[#25D366] outline-none text-sm sm:text-base"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm text-white/80 mb-1.5 sm:mb-2">שם בעל החשבון</label>
                <input
                  type="text"
                  placeholder="שם מלא"
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-[#25D366] outline-none text-sm sm:text-base"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm text-white/80 mb-1.5 sm:mb-2">מספר חשבון</label>
                <input
                  type="text"
                  placeholder="IBAN או מספר חשבון"
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-[#25D366] outline-none text-sm sm:text-base"
                  dir="ltr"
                />
              </div>
            </div>

            <button className="w-full py-2 sm:py-3 bg-[#25D366] text-white rounded-lg font-medium hover:bg-[#20bd5a] transition-colors mt-4 sm:mt-6 text-sm sm:text-base">
              שלח בקשת משיכה
            </button>

            <button
              onClick={() => setShowWithdrawModal(false)}
              className="w-full py-2 sm:py-3 text-white/60 hover:text-white mt-2 text-sm sm:text-base"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
