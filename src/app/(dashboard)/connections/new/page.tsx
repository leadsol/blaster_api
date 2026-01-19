'use client'

import { useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import { ChevronLeft } from 'lucide-react'

// Custom SVG Icons matching the Figma design
const QrIcon = () => (
  <svg width="27" height="27" viewBox="0 0 27 27" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4.17578 5.42862C4.17578 4.73705 4.73705 4.17578 5.42862 4.17578H10.44C11.1316 4.17578 11.6928 4.73705 11.6928 5.42862V10.44C11.6928 11.1316 11.1316 11.6928 10.44 11.6928H5.42862C5.09635 11.6928 4.77768 11.5608 4.54273 11.3259C4.30778 11.0909 4.17578 10.7723 4.17578 10.44V5.42862ZM4.17578 16.2866C4.17578 15.595 4.73705 15.0337 5.42862 15.0337H10.44C11.1316 15.0337 11.6928 15.595 11.6928 16.2866V21.2979C11.6928 21.9895 11.1316 22.5508 10.44 22.5508H5.42862C5.09635 22.5508 4.77768 22.4188 4.54273 22.1838C4.30778 21.9489 4.17578 21.6302 4.17578 21.2979V16.2866ZM15.0337 5.42862C15.0337 4.73705 15.595 4.17578 16.2866 4.17578H21.2979C21.9895 4.17578 22.5508 4.73705 22.5508 5.42862V10.44C22.5508 11.1316 21.9895 11.6928 21.2979 11.6928H16.2866C15.9543 11.6928 15.6356 11.5608 15.4007 11.3259C15.1657 11.0909 15.0337 10.7723 15.0337 10.44V5.42862Z" stroke="white" strokeWidth="1.67045" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7.51562 7.51758H8.35085V8.35281H7.51562V7.51758ZM7.51562 18.3755H8.35085V19.2108H7.51562V18.3755ZM18.3736 7.51758H19.2088V8.35281H18.3736V7.51758ZM15.0327 15.0346H15.8679V15.8699H15.0327V15.0346ZM15.0327 21.7164H15.8679V22.5517H15.0327V21.7164ZM21.7145 15.0346H22.5497V15.8699H21.7145V15.0346ZM21.7145 21.7164H22.5497V22.5517H21.7145V21.7164ZM18.3736 18.3755H19.2088V19.2108H18.3736V18.3755Z" stroke="white" strokeWidth="1.67045" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const SendIcon = () => (
  <svg width="27" height="27" viewBox="0 0 27 27" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24.9215 3.99805L12.5743 23.6306L10.6952 13.9595L2.25 8.88588L24.9215 3.99805Z" stroke="white" strokeWidth="1.6875" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10.6367 13.9997L24.9207 3.99805" stroke="white" strokeWidth="1.6875" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const LockIcon = () => (
  <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.1875 10.9375V7.03125C17.1875 5.78805 16.6936 4.59576 15.8146 3.71669C14.9355 2.83761 13.7432 2.34375 12.5 2.34375C11.2568 2.34375 10.0645 2.83761 9.18544 3.71669C8.30636 4.59576 7.8125 5.78805 7.8125 7.03125V10.9375M7.03125 22.6562H17.9687C18.5904 22.6562 19.1865 22.4093 19.626 21.9698C20.0656 21.5302 20.3125 20.9341 20.3125 20.3125V13.2812C20.3125 12.6596 20.0656 12.0635 19.626 11.624C19.1865 11.1844 18.5904 10.9375 17.9687 10.9375H7.03125C6.40965 10.9375 5.81351 11.1844 5.37397 11.624C4.93443 12.0635 4.6875 12.6596 4.6875 13.2812V20.3125C4.6875 20.9341 4.93443 21.5302 5.37397 21.9698C5.81351 22.4093 6.40965 22.6562 7.03125 22.6562Z" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function NewConnectionPage() {
  const router = useRouter()
  const { darkMode } = useTheme()

  const connectionMethods = [
    {
      id: 'qr',
      icon: QrIcon,
      title: 'סריקת QR קוד',
      description: 'סרוק את קוד ה-QR שמופיע במסך הוואטסאפ שלך.',
      buttonText: 'סריקת QR קוד',
      action: () => router.push('/connections/new/qr'),
      mockupImage: 'https://res.cloudinary.com/dimsgvsze/image/upload/v1768655025/2_uxywkr.png'
    },
    {
      id: 'send',
      icon: SendIcon,
      title: 'שליחת קוד QR לטלפון אחר',
      description: 'שלח את קוד ה-QR למכשיר אחר במידה והמכשיר אינו ברשותך כרגע.',
      buttonText: 'שליחת קוד QR',
      action: () => router.push('/connections/new/send'),
      mockupImage: 'https://res.cloudinary.com/dimsgvsze/image/upload/v1768655037/3_hzid4j.png'
    },
    {
      id: 'code',
      icon: LockIcon,
      title: 'חיבור באמצעות קוד אימות',
      description: 'הזן קוד אימות ייחודי אם אין אפשרות לסרוק QR.',
      buttonText: 'חיבור עם קוד אימות',
      action: () => router.push('/connections/new/code'),
      mockupImage: 'https://res.cloudinary.com/dimsgvsze/image/upload/v1768655040/4_vgukla.png'
    }
  ]

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-[#0a1628]' : 'bg-[#e8f4fc]'}`} dir="rtl">
      <div className="w-full px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => router.push('/connections')}
            className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-[#1a2942]' : 'hover:bg-white'}`}
          >
            <ChevronLeft className={`w-6 h-6 rotate-180 ${darkMode ? 'text-white' : 'text-[#030733]'}`} />
          </button>
          <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
            יצירת קונקשן חדש
          </h1>
        </div>

        <p className={`text-right mb-10 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          איך תרצה לבצע את החיבור?
        </p>

        {/* Connection method cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {connectionMethods.map((method) => {
            const Icon = method.icon
            return (
              <div
                key={method.id}
                className={`rounded-[24px] p-6 flex flex-col overflow-hidden h-[680px]
                  ${darkMode
                    ? 'bg-[#1a2942]'
                    : 'bg-white'
                  }`}
              >
                {/* Icon */}
                <div className="flex justify-center mb-4">
                  <div className="w-[49px] h-[49px] rounded-[8.91px] bg-[#030733] flex items-center justify-center">
                    <Icon />
                  </div>
                </div>

                {/* Text content */}
                <h3 className={`text-[18px] font-semibold text-center mb-2 whitespace-nowrap ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                  {method.title}
                </h3>
                <p className={`text-[13px] text-center mb-6 ${darkMode ? 'text-gray-400' : 'text-[#030733]'}`}>
                  {method.description}
                </p>

                {/* Action button */}
                <button
                  onClick={method.action}
                  className="w-full py-3 bg-[#030733] text-white text-[14px] font-semibold rounded-[8px] hover:bg-[#1a1a4a] transition-colors"
                >
                  {method.buttonText}
                </button>

                {/* Phone mockup */}
                <div className="mt-6 flex justify-center items-start flex-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={method.mockupImage}
                    alt={method.title}
                    className="w-72 h-auto object-contain translate-y-6"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
