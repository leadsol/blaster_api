'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showPasswordTooltip, setShowPasswordTooltip] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Password validation
  const validatePassword = (pass: string) => {
    const hasMinLength = pass.length >= 8
    const hasUpperCase = /[A-Z]/.test(pass)
    const hasLowerCase = /[a-z]/.test(pass)
    const hasNumber = /[0-9]/.test(pass)
    const hasSpecialChar = /[!@#$%^&*]/.test(pass)
    return hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validatePassword(password)) {
      setError('הסיסמה לא עומדת בדרישות האבטחה')
      return
    }

    if (password !== confirmPassword) {
      setError('הסיסמאות לא תואמות')
      return
    }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      setError('אירעה שגיאה בעדכון הסיסמה. נסה שוב.')
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)

    // Redirect after success
    setTimeout(() => {
      router.push('/login')
    }, 2000)
  }

  return (
    <div className="min-h-screen flex bg-[#030733] relative overflow-hidden" dir="rtl">
      {/* Background blur circles */}
      <div className="absolute w-[551px] h-[551px] rounded-full bg-[#0043E0] opacity-[0.18] blur-[216px] top-[-399px] right-[9px]" />
      <div className="absolute w-[551px] h-[551px] rounded-full bg-[#0043E0] opacity-[0.22] blur-[216px] top-[815px] right-[182px]" />
      <div className="absolute w-[551px] h-[551px] rounded-full bg-[#0043E0] opacity-[0.22] blur-[216px] top-[-537px] right-[-167px]" />

      {/* Right Side - Form Panel */}
      <div className="flex-1 lg:flex-none lg:w-[50%] flex items-center justify-center p-4 lg:p-[19px]">
        <div className="w-full max-w-[942px] h-[calc(100vh-38px)] bg-[#F2F3F8] rounded-[25px] p-6 lg:px-[45px] lg:pt-[15px] lg:pb-[25px] relative overflow-hidden">
          {/* Header - Logo on right side (RTL), Back link on left side */}
          <div className="flex items-center justify-between">
            <img
              src="https://res.cloudinary.com/dimsgvsze/image/upload/v1768252856/BY_3_exro8m.png"
              alt="LeadSol Logo"
              className="h-[100px] w-auto"
            />
            <p className="text-[#030733] text-[14px]">
              אין לך חשבון עדיין? <Link href="/register" className="text-[#0043E0] underline">להרשמה</Link>
            </p>
          </div>

          {/* Content */}
          <div className="mt-[60px] max-w-[468px] mx-auto">
            {success ? (
              // Success State
              <div className="text-center">
                <h1 className="text-[24px] lg:text-[35px] font-semibold text-[#030733] leading-[1.4] mb-4">
                  הסיסמא אופסה בהצלחה!
                </h1>
                <p className="text-[#3B3B3C] text-[14px] lg:text-[18px] font-light mb-8">
                  בעוד רגע תעבור למסך ההתחברות
                </p>
                {/* Success checkmark circle */}
                <div className="w-[134px] h-[134px] bg-[#030733] rounded-full flex items-center justify-center mx-auto">
                  <svg width="57" height="43" viewBox="0 0 57 43" fill="none">
                    <path d="M3.09375 24.6938L17.4937 39.0938L35.4937 21.0938L53.4937 3.09375" stroke="#F2F3F8" strokeWidth="6.19" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            ) : (
              // Form State
              <>
                <h1 className="text-[24px] lg:text-[35px] font-semibold text-[#030733] text-center leading-[1.4]">
                  צור סיסמה חדשה
                </h1>
                <p className="text-[#3B3B3C] text-[14px] lg:text-[18px] font-light text-center mt-[10px]">
                  בחר סיסמה חזקה כדי לאבטח את החשבון שלך.
                </p>

                <form onSubmit={handleSubmit} className="mt-[25px] space-y-[18px]">
                  {/* New Password field */}
                  <div>
                    <div className="flex items-center gap-2 mb-[10px]">
                      <label className="text-[16px] lg:text-[18px] text-[#030733] text-right">
                        סיסמא
                      </label>
                      <div
                        className="relative"
                        onMouseEnter={() => setShowPasswordTooltip(true)}
                        onMouseLeave={() => setShowPasswordTooltip(false)}
                      >
                        <div className="w-[14px] h-[14px] bg-[#030733] rounded-full flex items-center justify-center cursor-help">
                          <span className="text-[#F2F3F8] text-[10px]">?</span>
                        </div>
                        {/* Password requirements tooltip */}
                        {showPasswordTooltip && (
                          <div className="absolute top-[20px] right-0 w-[336px] bg-[#030733] rounded-[10px] p-4 z-50 shadow-lg">
                            <p className="text-white text-[14px] font-semibold text-right mb-2">הסיסמה חייבת לכלול:</p>
                            <div className="text-[#F2F3F8] text-[14px] font-light text-right leading-[1.8]">
                              <p>לפחות 8 תווים</p>
                              <p>לפחות אות אחת גדולה (A–Z)</p>
                              <p>לפחות אות אחת קטנה (a–z)</p>
                              <p>לפחות מספר אחד (0–9)</p>
                              <p>לפחות תו מיוחד אחד (למשל ! @ # $ % ^ & *)</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="הסיסמה שתרצה"
                        className="w-full h-[49px] px-4 pl-12 rounded-[10px] border-[0.5px] border-[#595C7A] bg-transparent text-[#030733] placeholder-[#595C77] text-[14px] font-light text-right outline-none focus:ring-2 focus:ring-[#0043E0] focus:border-transparent"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-[15px] top-1/2 -translate-y-1/2 text-[#030733]"
                      >
                        {showPassword ? <EyeOff className="w-[19px] h-[19px]" /> : <Eye className="w-[19px] h-[19px]" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password field */}
                  <div>
                    <label className="block text-[16px] lg:text-[18px] text-[#030733] mb-[10px] text-right">
                      אמת סיסמה
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="הקלד שוב את הסיסמה שלך"
                        className="w-full h-[49px] px-4 pl-12 rounded-[10px] border-[0.5px] border-[#595C7A] bg-transparent text-[#030733] placeholder-[#595C77] text-[14px] font-light text-right outline-none focus:ring-2 focus:ring-[#0043E0] focus:border-transparent"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute left-[15px] top-1/2 -translate-y-1/2 text-[#030733]"
                      >
                        {showConfirmPassword ? <EyeOff className="w-[19px] h-[19px]" /> : <Eye className="w-[19px] h-[19px]" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 text-red-600 px-4 py-3 rounded-[10px] text-[14px] text-right">
                      {error}
                    </div>
                  )}

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-[49px] bg-[#0043E0] text-white rounded-[10px] font-semibold text-[18px] hover:bg-[#0035b0] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-[25px]"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        הגדרת סיסמא חדשה
                        <svg className="w-[12px] h-[13px]" viewBox="0 0 12 13" fill="none">
                          <path d="M7.875 10.5625L4.125 6.5L7.875 2.4375" stroke="white" strokeWidth="0.93" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="absolute bottom-[30px] left-[28px] right-[28px] flex items-center justify-between text-[14px] text-[#595C7A]">
            <div className="flex gap-6">
              <Link href="/privacy" className="font-light hover:underline">מדיניות פרטיות</Link>
              <Link href="/support" className="font-light hover:underline">תמיכה</Link>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[12px] font-light">2024 LeadSol</span>
              <span className="text-[10px]">©</span>
            </div>
          </div>
        </div>
      </div>

      {/* Left Side - Quote Panel */}
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

        {/* Preview Image */}
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
