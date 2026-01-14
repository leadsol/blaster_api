'use client'

import { useState } from 'react'
import {
  BookOpen,
  Video,
  FileText,
  HelpCircle,
  ExternalLink,
  Search,
  Play,
  Clock,
  Star,
  ChevronRight,
  Lightbulb,
  Zap,
  MessageSquare,
  Users,
  BarChart3,
  Shield
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

interface Resource {
  id: string
  title: string
  description: string
  type: 'article' | 'video' | 'guide' | 'faq'
  category: string
  duration?: string
  isNew?: boolean
  isFeatured?: boolean
}

const categories = [
  { id: 'all', name: 'הכל', icon: BookOpen },
  { id: 'getting-started', name: 'התחלה מהירה', icon: Zap },
  { id: 'messaging', name: 'הודעות וקמפיינים', icon: MessageSquare },
  { id: 'contacts', name: 'ניהול אנשי קשר', icon: Users },
  { id: 'analytics', name: 'דוחות ואנליטיקה', icon: BarChart3 },
  { id: 'security', name: 'אבטחה וחיבורים', icon: Shield },
]

const resources: Resource[] = [
  {
    id: '1',
    title: 'מדריך התחלה מהירה - 5 דקות לקמפיין ראשון',
    description: 'למד כיצד להגדיר את החשבון שלך ולשלוח את הקמפיין הראשון שלך בפחות מ-5 דקות',
    type: 'video',
    category: 'getting-started',
    duration: '5 דקות',
    isFeatured: true,
    isNew: true,
  },
  {
    id: '2',
    title: 'חיבור WhatsApp - מדריך מלא',
    description: 'הסבר מפורט על כל שלב בתהליך החיבור של WhatsApp לחשבון LeadSol שלך',
    type: 'guide',
    category: 'security',
    duration: '10 דקות',
    isFeatured: true,
  },
  {
    id: '3',
    title: 'איך ליצור קמפיין אפקטיבי',
    description: 'טיפים וטריקים ליצירת קמפיינים שממירים - מהניסוח ועד התזמון המושלם',
    type: 'article',
    category: 'messaging',
    duration: '8 דקות',
  },
  {
    id: '4',
    title: 'ייבוא אנשי קשר מאקסל',
    description: 'מדריך צעד אחר צעד לייבוא רשימת אנשי קשר מקובץ Excel או CSV',
    type: 'video',
    category: 'contacts',
    duration: '4 דקות',
    isNew: true,
  },
  {
    id: '5',
    title: 'הבנת הדוחות והסטטיסטיקות',
    description: 'למד לקרוא את הדוחות שלך ולהפיק תובנות לשיפור הביצועים',
    type: 'article',
    category: 'analytics',
    duration: '12 דקות',
  },
  {
    id: '6',
    title: 'שאלות נפוצות - חיבור WhatsApp',
    description: 'תשובות לשאלות הנפוצות ביותר על חיבור וניהול חשבון WhatsApp',
    type: 'faq',
    category: 'security',
  },
  {
    id: '7',
    title: 'טקסט ספינינג - מדריך מתקדם',
    description: 'למד כיצד להשתמש בטקסט ספינינג כדי ליצור וריאציות אוטומטיות להודעות',
    type: 'guide',
    category: 'messaging',
    duration: '7 דקות',
  },
  {
    id: '8',
    title: 'ניהול תגיות ולייבלים',
    description: 'איך לארגן את אנשי הקשר שלך עם תגיות חכמות לשיווק ממוקד',
    type: 'article',
    category: 'contacts',
    duration: '5 דקות',
  },
  {
    id: '9',
    title: 'שאלות נפוצות - תמחור וחבילות',
    description: 'מידע על חבילות, מכסות הודעות ושדרוג החשבון',
    type: 'faq',
    category: 'getting-started',
  },
  {
    id: '10',
    title: 'אוטומציה ובוטים - מבוא',
    description: 'הכרות עם מערכת האוטומציה והבוטים של LeadSol',
    type: 'video',
    category: 'messaging',
    duration: '15 דקות',
    isNew: true,
  },
  {
    id: '11',
    title: 'שעות פעילות - תזמון חכם של הודעות',
    description: 'למד כיצד להגדיר שעות פעילות לקמפיינים כדי לשלוח הודעות רק בשעות מסוימות ביום',
    type: 'guide',
    category: 'messaging',
    duration: '6 דקות',
    isFeatured: true,
    isNew: true,
  },
]

const getTypeIcon = (type: Resource['type']) => {
  switch (type) {
    case 'video':
      return <Video className="w-4 h-4" />
    case 'article':
      return <FileText className="w-4 h-4" />
    case 'guide':
      return <BookOpen className="w-4 h-4" />
    case 'faq':
      return <HelpCircle className="w-4 h-4" />
  }
}

const getTypeBg = (type: Resource['type'], darkMode: boolean) => {
  switch (type) {
    case 'video':
      return darkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'
    case 'article':
      return darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
    case 'guide':
      return darkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'
    case 'faq':
      return darkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'
  }
}

const getTypeLabel = (type: Resource['type']) => {
  switch (type) {
    case 'video':
      return 'וידאו'
    case 'article':
      return 'מאמר'
    case 'guide':
      return 'מדריך'
    case 'faq':
      return 'שאלות נפוצות'
  }
}

export default function ResourcesPage() {
  const { darkMode } = useTheme()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedType, setSelectedType] = useState<string>('all')

  const filteredResources = resources.filter(resource => {
    const matchesSearch = resource.title.includes(searchQuery) || resource.description.includes(searchQuery)
    const matchesCategory = selectedCategory === 'all' || resource.category === selectedCategory
    const matchesType = selectedType === 'all' || resource.type === selectedType
    return matchesSearch && matchesCategory && matchesType
  })

  const featuredResources = resources.filter(r => r.isFeatured)

  return (
    <div className="p-3 sm:p-4 lg:p-6 h-full overflow-y-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className={`text-lg sm:text-xl lg:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
            מרכז משאבים
          </h1>
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-1 text-xs sm:text-sm`}>מדריכים, וידאו ומאמרים שיעזרו לך להפיק את המקסימום מ-LeadSol</p>
        </div>
      </div>

      {/* Search */}
      <div className={`${darkMode ? 'bg-[#142241] border-[#1e3a5f]' : 'bg-white border-gray-200'} rounded-lg sm:rounded-xl border p-3 sm:p-4 mb-4 sm:mb-6`}>
        <div className="relative">
          <Search className={`absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חפש מדריכים, מאמרים ווידאו..."
            className={`w-full pr-10 sm:pr-12 pl-4 py-2.5 sm:py-3 rounded-lg border focus:ring-2 focus:ring-[#0043E0] focus:border-transparent outline-none text-sm sm:text-base ${
              darkMode ? 'bg-[#1a2d4a] border-[#2a3f5f] text-white placeholder-gray-500' : 'border-gray-200 text-gray-900'
            }`}
          />
        </div>
      </div>

      {/* Featured Section */}
      {selectedCategory === 'all' && !searchQuery && (
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h2 className={`text-base sm:text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-3 sm:mb-4 flex items-center gap-2`}>
            <Star className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
            מומלצים
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {featuredResources.map(resource => (
              <div
                key={resource.id}
                className={`${darkMode ? 'bg-gradient-to-br from-[#0043E0] to-[#030733]' : 'bg-gradient-to-br from-[#1e3a5f] to-[#2a4a73]'} rounded-lg sm:rounded-xl p-4 sm:p-6 text-white hover:shadow-lg transition-shadow cursor-pointer`}
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium bg-white/20">
                    {getTypeLabel(resource.type)}
                  </div>
                  {resource.isNew && (
                    <span className="bg-green-500 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                      חדש
                    </span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg lg:text-xl font-bold mb-1.5 sm:mb-2">{resource.title}</h3>
                <p className="text-white/80 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">{resource.description}</p>
                <div className="flex items-center justify-between">
                  {resource.duration && (
                    <span className="flex items-center gap-1 text-xs sm:text-sm text-white/60">
                      <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {resource.duration}
                    </span>
                  )}
                  <button className="flex items-center gap-1 text-xs sm:text-sm font-medium hover:underline">
                    {resource.type === 'video' ? 'צפה עכשיו' : 'קרא עוד'}
                    <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Sidebar Categories */}
        <div className="lg:w-56 xl:w-64 lg:flex-shrink-0">
          <div className={`${darkMode ? 'bg-[#142241] border-[#1e3a5f]' : 'bg-white border-gray-200'} rounded-lg sm:rounded-xl border p-3 sm:p-4 lg:sticky lg:top-6`}>
            <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'} mb-3 sm:mb-4 text-sm sm:text-base`}>קטגוריות</h3>
            <div className="flex lg:flex-col gap-1 sm:gap-2 lg:gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {categories.map(category => {
                const Icon = category.icon
                const count = category.id === 'all'
                  ? resources.length
                  : resources.filter(r => r.category === category.id).length
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`flex items-center justify-between px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors whitespace-nowrap lg:whitespace-normal flex-shrink-0 lg:flex-shrink lg:w-full text-xs sm:text-sm ${
                      selectedCategory === category.id
                        ? 'bg-[#0043E0] text-white'
                        : darkMode ? 'text-gray-300 hover:bg-[#1a2d4a]' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 sm:gap-2">
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {category.name}
                    </span>
                    <span className={`text-xs sm:text-sm mr-1 lg:mr-0 ${selectedCategory === category.id ? 'text-white/70' : darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <hr className={`my-3 sm:my-4 hidden lg:block ${darkMode ? 'border-[#2a3f5f]' : 'border-gray-200'}`} />

            <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'} mb-3 sm:mb-4 text-sm sm:text-base hidden lg:block`}>סוג תוכן</h3>
            <div className="hidden lg:flex flex-col gap-2">
              {[
                { id: 'all', label: 'הכל' },
                { id: 'video', label: 'וידאו' },
                { id: 'article', label: 'מאמרים' },
                { id: 'guide', label: 'מדריכים' },
                { id: 'faq', label: 'שאלות נפוצות' },
              ].map(type => (
                <label key={type.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    checked={selectedType === type.id}
                    onChange={() => setSelectedType(type.id)}
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#0043E0]"
                  />
                  <span className={`text-xs sm:text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{type.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Resources Grid */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <span className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {filteredResources.length} תוצאות
            </span>
          </div>

          {filteredResources.length === 0 ? (
            <div className={`${darkMode ? 'bg-[#142241] border-[#1e3a5f]' : 'bg-white border-gray-200'} rounded-lg sm:rounded-xl border p-6 sm:p-8 lg:p-12 text-center`}>
              <div className={`w-12 h-12 sm:w-16 sm:h-16 ${darkMode ? 'bg-[#1a2d4a]' : 'bg-gray-100'} rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4`}>
                <Search className={`w-6 h-6 sm:w-8 sm:h-8 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
              </div>
              <h3 className={`text-base sm:text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'} mb-2`}>לא נמצאו תוצאות</h3>
              <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-xs sm:text-sm`}>נסה לחפש במילים אחרות או לבחור קטגוריה אחרת</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {filteredResources.map(resource => (
                <div
                  key={resource.id}
                  className={`${darkMode ? 'bg-[#142241] border-[#1e3a5f] hover:bg-[#1a2d4a]' : 'bg-white border-gray-200 hover:shadow-md'} rounded-lg sm:rounded-xl border p-3 sm:p-4 lg:p-5 transition-shadow cursor-pointer group`}
                >
                  <div className="flex items-start justify-between mb-2 sm:mb-3">
                    <div className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${getTypeBg(resource.type, darkMode)}`}>
                      {getTypeIcon(resource.type)}
                      {getTypeLabel(resource.type)}
                    </div>
                    {resource.isNew && (
                      <span className={`${darkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'} text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full`}>
                        חדש
                      </span>
                    )}
                  </div>
                  <h3 className={`font-semibold text-sm sm:text-base ${darkMode ? 'text-white group-hover:text-[#0043E0]' : 'text-gray-900 group-hover:text-[#1e3a5f]'} mb-1.5 sm:mb-2 transition-colors`}>
                    {resource.title}
                  </h3>
                  <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-3 sm:mb-4 line-clamp-2`}>
                    {resource.description}
                  </p>
                  <div className="flex items-center justify-between">
                    {resource.duration ? (
                      <span className={`flex items-center gap-1 text-[10px] sm:text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        {resource.duration}
                      </span>
                    ) : (
                      <span></span>
                    )}
                    <button className={`flex items-center gap-1 text-xs sm:text-sm ${darkMode ? 'text-[#0043E0]' : 'text-[#1e3a5f]'} font-medium sm:opacity-0 sm:group-hover:opacity-100 transition-opacity`}>
                      {resource.type === 'video' ? (
                        <>
                          <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          צפה
                        </>
                      ) : (
                        <>
                          קרא
                          <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Help CTA */}
      <div className={`mt-4 sm:mt-6 lg:mt-8 ${darkMode ? 'bg-[#142241]' : 'bg-gradient-to-r from-[#1e3a5f]/10 to-[#25D366]/10'} rounded-lg sm:rounded-xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4`}>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className={`w-10 h-10 sm:w-12 sm:h-12 ${darkMode ? 'bg-[#0043E0]' : 'bg-[#1e3a5f]'} rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0`}>
            <Lightbulb className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} text-sm sm:text-base`}>לא מצאת את מה שחיפשת?</h3>
            <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>צוות התמיכה שלנו זמין לעזור לך בכל שאלה</p>
          </div>
        </div>
        <button className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 ${darkMode ? 'bg-[#0043E0] hover:bg-[#0035b0]' : 'bg-[#1e3a5f] hover:bg-[#2a4a73]'} text-white rounded-lg transition-colors text-xs sm:text-sm w-full sm:w-auto`}>
          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
          פתח פניה לתמיכה
        </button>
      </div>
    </div>
  )
}
