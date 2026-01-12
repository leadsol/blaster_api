'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('אימייל או סיסמה לא נכונים')
      setLoading(false)
      return
    }

    router.push('/onboarding/workspace')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#030733] relative overflow-hidden" dir="rtl">
      {/* Background blur circles - hidden on mobile for performance */}
      <div className="hidden sm:block absolute w-[551px] h-[551px] rounded-full bg-[#0043E0] opacity-[0.18] blur-[216px] top-[-399px] right-[9px]" />
      <div className="hidden sm:block absolute w-[551px] h-[551px] rounded-full bg-[#0043E0] opacity-[0.22] blur-[216px] top-[815px] right-[182px]" />
      <div className="hidden sm:block absolute w-[551px] h-[551px] rounded-full bg-[#0043E0] opacity-[0.22] blur-[216px] top-[-537px] right-[-167px]" />

      {/* Right Side - Login Panel (WHITE PANEL - should be on RIGHT in RTL) */}
      <div className="flex-1 lg:flex-none lg:w-[50%] flex items-center justify-center p-3 sm:p-4 lg:p-[19px]">
        <div className="w-full max-w-[942px] min-h-[calc(100vh-24px)] sm:min-h-[calc(100vh-32px)] lg:h-[calc(100vh-38px)] bg-[#F2F3F8] rounded-[15px] sm:rounded-[20px] lg:rounded-[25px] p-4 sm:p-6 lg:px-[45px] lg:pt-[15px] lg:pb-[25px] relative overflow-hidden flex flex-col">
          {/* Header - Logo on right side (RTL), Register link on left side */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <img
              src="https://res.cloudinary.com/dimsgvsze/image/upload/v1768252856/BY_3_exro8m.png"
              alt="LeadSol Logo"
              className="h-[60px] sm:h-[80px] lg:h-[100px] w-auto"
            />
            <p className="text-[#030733] text-[12px] sm:text-[14px]">
              אין לך חשבון עדיין? <Link href="/register" className="text-[#0043E0] underline">להרשמה</Link>
            </p>
          </div>

          {/* Title - centered */}
          <div className="mt-6 sm:mt-10 lg:mt-[50px]">
            <h1 className="text-[20px] sm:text-[24px] lg:text-[30px] font-semibold text-[#030733] text-center leading-[1.4]">
              שמחים לראות אותך שוב ב-LeadSol!
            </h1>
            <p className="text-[#3B3B3C] text-[13px] sm:text-[14px] lg:text-[16px] font-light text-center mt-2 sm:mt-[10px]">
              אנא הזן את פרטיך כדי להתחבר לחשבונך
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-0 w-full max-w-[468px] mx-auto mt-4 sm:mt-6 lg:mt-[25px] flex-1">
            {/* Email field */}
            <div>
              <label className="block text-[14px] sm:text-[16px] lg:text-[18px] text-[#030733] mb-2 sm:mb-[10px] text-right">
                אימייל
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="הזן את האימייל שלך"
                className="w-full h-[44px] sm:h-[49px] px-3 sm:px-4 rounded-[10px] border-[0.5px] border-[#595C7A] bg-transparent text-[#030733] placeholder-[#595C7A] text-[14px] font-light text-right outline-none focus:ring-2 focus:ring-[#0043E0] focus:border-transparent"
                dir="ltr"
                required
              />
            </div>

            {/* Password field */}
            <div className="mt-3 sm:mt-[18px]">
              <label className="block text-[14px] sm:text-[16px] lg:text-[18px] text-[#030733] mb-2 sm:mb-[10px] text-right">
                סיסמא
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="הזן את סיסמתך"
                  className="w-full h-[44px] sm:h-[49px] px-3 sm:px-4 pl-12 rounded-[10px] border-[0.5px] border-[#595C7A] bg-transparent text-[#030733] placeholder-[#595C7A] text-[14px] font-light text-right outline-none focus:ring-2 focus:ring-[#0043E0] focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-[14px] top-1/2 -translate-y-1/2 text-[#030733] p-1"
                >
                  {showPassword ? <EyeOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Eye className="w-5 h-5 sm:w-6 sm:h-6" />}
                </button>
              </div>
            </div>

            {/* Remember device & Forgot password */}
            <div className="flex items-center justify-between mt-3 sm:mt-[12px] flex-wrap gap-2">
              <label className="flex items-center gap-2 sm:gap-3 cursor-pointer">
                <div className="relative flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-[17px] h-[17px] rounded-[4px] border-[0.65px] border-[#030733] flex items-center justify-center ${rememberDevice ? 'bg-[#030733]' : 'bg-transparent'}`}>
                    {rememberDevice && (
                      <svg className="w-[8px] h-[6px]" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="0.93"/>
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-[13px] sm:text-[14px] text-[#030733]">זכור מכשיר זה</span>
              </label>
              <Link href="/forgot-password" className="text-[13px] sm:text-[14px] text-[#595C7A] underline">
                שכחתי סיסמא?
              </Link>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-3 sm:px-4 py-2 sm:py-3 rounded-[10px] text-[13px] sm:text-[14px] text-right mt-3 sm:mt-4">
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[44px] sm:h-[49px] bg-[#0043E0] text-white rounded-[10px] font-semibold text-[16px] sm:text-[18px] hover:bg-[#0035b0] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-4 sm:mt-[25px]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  התחבר
                  <svg className="w-[13px] h-[12px] rotate-90" viewBox="0 0 13 12" fill="none">
                    <path d="M10.5625 4.125L6.5 7.875L2.4375 4.125" stroke="white" strokeWidth="0.93" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-auto pt-4 sm:pt-6 flex items-center justify-between text-[12px] sm:text-[14px] text-[#595C7A] flex-wrap gap-2">
            <div className="flex gap-4 sm:gap-6">
              <Link href="/privacy" className="font-light hover:underline">מדיניות פרטיות</Link>
              <Link href="/support" className="font-light hover:underline">תמיכה</Link>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] sm:text-[12px] font-light">2024 LeadSol</span>
              <span className="text-[10px]">©</span>
            </div>
          </div>
        </div>
      </div>

      {/* Left Side - Quote Panel (DARK PANEL - should be on LEFT in RTL) */}
      <div className="hidden lg:flex lg:w-[50%] flex-col justify-start items-center pt-16 p-8 relative">
        {/* Inner blur */}
        <div className="absolute w-[504px] h-[503px] rounded-full bg-[#1554E8] opacity-[0.18] blur-[170px] top-[406px] left-1/2 -translate-x-1/2" />

        <div className="relative z-10 max-w-[750px] text-right mt-[80px] px-[30px]">
          {/* Quote */}
          <p className="text-white text-[28px] lg:text-[32px] font-semibold leading-[1.5] mb-8">
            "עם Leadsol סגרנו 38% יותר לידים רק בזכות אוטומציה של המענה הראשוני. זה מרגיש כמו צוות מכירות שלא הולך לישון אף פעם"
          </p>

          {/* Author section */}
          <div className="flex items-center justify-start gap-4">
            {/* Quote icon */}
            <div className="w-[42px] h-[42px] bg-white rounded-[6px] flex items-center justify-center overflow-hidden">
              <span className="text-[#0043E0] text-[50px] font-serif leading-none mt-[6px]">"</span>
            </div>

            {/* Author info */}
            <div className="text-right">
              <p className="text-white text-[20px] font-semibold leading-[31px]">ירדן לוי</p>
              <p className="text-[#C3C3C3] text-[14px] leading-[21.7px]">מנהל חברת שיווק דיגיטלי</p>
            </div>
          </div>
        </div>

        {/* Preview Image - positioned at bottom, cropped as teaser */}
        <div className="absolute bottom-0 left-0 right-0 h-[350px] overflow-hidden">
          <img
            src="https://res.cloudinary.com/dimsgvsze/image/upload/v1768252812/yqwztgbtptuirkmo6gre_yx7urn.png"
            alt="LeadSol Preview"
            className="w-full h-auto object-cover object-top"
          />
        </div>
      </div>
    </div>
  )
}
