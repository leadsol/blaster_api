'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
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
      <div className="hidden sm:block absolute w-[400px] h-[400px] sm:w-[500px] sm:h-[500px] md:w-[551px] md:h-[551px] rounded-full bg-[#0043E0] opacity-[0.18] blur-[150px] sm:blur-[180px] md:blur-[216px] top-[-300px] sm:top-[-350px] md:top-[-399px] right-[9px]" />
      <div className="hidden sm:block absolute w-[400px] h-[400px] sm:w-[500px] sm:h-[500px] md:w-[551px] md:h-[551px] rounded-full bg-[#0043E0] opacity-[0.22] blur-[150px] sm:blur-[180px] md:blur-[216px] top-[600px] sm:top-[700px] md:top-[815px] right-[100px] sm:right-[140px] md:right-[182px]" />
      <div className="hidden sm:block absolute w-[400px] h-[400px] sm:w-[500px] sm:h-[500px] md:w-[551px] md:h-[551px] rounded-full bg-[#0043E0] opacity-[0.22] blur-[150px] sm:blur-[180px] md:blur-[216px] top-[-400px] sm:top-[-480px] md:top-[-537px] right-[-100px] sm:right-[-130px] md:right-[-167px]" />

      {/* Right Side - Login Panel (WHITE PANEL - should be on RIGHT in RTL) */}
      <div className="flex-1 lg:flex-none lg:w-[50%] xl:w-[55%] 2xl:w-[50%] flex items-center justify-center p-2 sm:p-3 md:p-4 lg:p-5 xl:p-[19px]">
        <div className="w-full max-w-[760px] md:max-w-[860px] lg:max-w-[920px] xl:max-w-[942px] min-h-[calc(100vh-16px)] sm:min-h-[calc(100vh-24px)] md:min-h-[calc(100vh-32px)] lg:h-[calc(100vh-40px)] xl:h-[calc(100vh-38px)] bg-[#F2F3F8] rounded-[12px] sm:rounded-[15px] md:rounded-[18px] lg:rounded-[22px] xl:rounded-[25px] p-3 sm:p-4 md:p-5 lg:p-6 xl:px-[45px] xl:pt-[15px] xl:pb-[25px] relative overflow-hidden flex flex-col">
          {/* Header - Logo on right side (RTL), Register link on left side */}
          <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-3">
            <Image
              src="https://res.cloudinary.com/dimsgvsze/image/upload/v1768252856/BY_3_exro8m.png"
              alt="LeadSol Logo"
              width={150}
              height={100}
              className="h-[50px] sm:h-[60px] md:h-[70px] lg:h-[85px] xl:h-[100px] w-auto"
              unoptimized
            />
            <p className="text-[#030733] text-[11px] sm:text-[12px] md:text-[13px] lg:text-[14px]">
              אין לך חשבון עדיין? <Link href="/register" className="text-[#0043E0] underline">להרשמה</Link>
            </p>
          </div>

          {/* Title - centered */}
          <div className="mt-4 sm:mt-6 md:mt-8 lg:mt-10 xl:mt-[50px]">
            <h1 className="text-[18px] sm:text-[20px] md:text-[22px] lg:text-[26px] xl:text-[30px] font-semibold text-[#030733] text-center leading-[1.4]">
              שמחים לראות אותך שוב ב-LeadSol!
            </h1>
            <p className="text-[#3B3B3C] text-[12px] sm:text-[13px] md:text-[14px] lg:text-[15px] xl:text-[16px] font-light text-center mt-1.5 sm:mt-2 md:mt-2.5 lg:mt-[10px]">
              אנא הזן את פרטיך כדי להתחבר לחשבונך
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-0 w-full max-w-[420px] md:max-w-[450px] lg:max-w-[468px] mx-auto mt-3 sm:mt-4 md:mt-5 lg:mt-6 xl:mt-[25px] flex-1">
            {/* Email field */}
            <div>
              <label className="block text-[13px] sm:text-[14px] md:text-[15px] lg:text-[16px] xl:text-[18px] text-[#030733] mb-1.5 sm:mb-2 md:mb-2.5 lg:mb-[10px] text-right">
                אימייל
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="הזן את האימייל שלך"
                className="w-full h-[40px] sm:h-[44px] md:h-[46px] lg:h-[48px] xl:h-[49px] px-2.5 sm:px-3 md:px-3.5 lg:px-4 rounded-[8px] sm:rounded-[9px] md:rounded-[10px] border-[0.5px] border-[#595C7A] bg-transparent text-[#030733] placeholder-[#595C7A] text-[12px] sm:text-[13px] md:text-[14px] font-light text-right outline-none focus:ring-2 focus:ring-[#0043E0] focus:border-transparent"
                dir="ltr"
                required
              />
            </div>

            {/* Password field */}
            <div className="mt-2.5 sm:mt-3 md:mt-4 lg:mt-[18px]">
              <label className="block text-[13px] sm:text-[14px] md:text-[15px] lg:text-[16px] xl:text-[18px] text-[#030733] mb-1.5 sm:mb-2 md:mb-2.5 lg:mb-[10px] text-right">
                סיסמא
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="הזן את סיסמתך"
                  className="w-full h-[40px] sm:h-[44px] md:h-[46px] lg:h-[48px] xl:h-[49px] px-2.5 sm:px-3 md:px-3.5 lg:px-4 pl-10 sm:pl-11 md:pl-12 rounded-[8px] sm:rounded-[9px] md:rounded-[10px] border-[0.5px] border-[#595C7A] bg-transparent text-[#030733] placeholder-[#595C7A] text-[12px] sm:text-[13px] md:text-[14px] font-light text-right outline-none focus:ring-2 focus:ring-[#0043E0] focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-[10px] sm:left-[12px] md:left-[14px] top-1/2 -translate-y-1/2 text-[#030733] p-0.5 sm:p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />}
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
              className="w-full h-[40px] sm:h-[44px] md:h-[46px] lg:h-[48px] xl:h-[49px] bg-[#0043E0] text-white rounded-[8px] sm:rounded-[9px] md:rounded-[10px] font-semibold text-[14px] sm:text-[16px] md:text-[17px] lg:text-[18px] hover:bg-[#0035b0] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 sm:gap-2 mt-3 sm:mt-4 md:mt-5 lg:mt-[25px]"
            >
              {loading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : (
                <>
                  התחבר
                  <svg className="w-[12px] h-[11px] sm:w-[13px] sm:h-[12px] rotate-90" viewBox="0 0 13 12" fill="none">
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
            &ldquo;עם Leadsol סגרנו 38% יותר לידים רק בזכות אוטומציה של המענה הראשוני. זה מרגיש כמו צוות מכירות שלא הולך לישון אף פעם&rdquo;
          </p>

          {/* Author section */}
          <div className="flex items-center justify-start gap-4">
            {/* Quote icon */}
            <div className="w-[42px] h-[42px] bg-white rounded-[6px] flex items-center justify-center overflow-hidden">
              <span className="text-[#0043E0] text-[50px] font-serif leading-none mt-[6px]">&ldquo;</span>
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
          <Image
            src="https://res.cloudinary.com/dimsgvsze/image/upload/v1768252812/yqwztgbtptuirkmo6gre_yx7urn.png"
            alt="LeadSol Preview"
            width={800}
            height={350}
            className="w-full h-auto object-cover object-top"
            unoptimized
          />
        </div>
      </div>
    </div>
  )
}
