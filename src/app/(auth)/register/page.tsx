'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showPasswordTooltip, setShowPasswordTooltip] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreeMarketing, setAgreeMarketing] = useState(false)
  const [loading, setLoading] = useState(false)
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validatePassword(password)) {
      setError('הסיסמה לא עומדת בדרישות האבטחה')
      return
    }
    if (password !== confirmPassword) {
      setError('הסיסמאות לא תואמות')
      return
    }
    if (!agreeTerms) {
      setError('יש לאשר את תנאי השימוש')
      return
    }

    setLoading(true)
    setError('')

    const supabase = createClient()

    // Check if user already exists in profiles
    const { data: existingUsers } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)

    if (existingUsers && existingUsers.length > 0) {
      setError('משתמש עם אימייל זה כבר קיים במערכת')
      setLoading(false)
      return
    }

    // Send OTP to email
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: {
          full_name: `${firstName} ${lastName}`,
          first_name: firstName,
          last_name: lastName,
          password_hash: password, // We'll set the password after verification
        },
      },
    })

    if (otpError) {
      setError(otpError.message)
      setLoading(false)
      return
    }

    // Save user data for verification page
    localStorage.setItem('pendingVerificationEmail', email)
    localStorage.setItem('pendingUserData', JSON.stringify({
      firstName,
      lastName,
      password,
    }))

    router.push('/verify-email')
  }

  return (
    <div className="min-h-screen flex bg-[#030733] relative overflow-hidden" dir="rtl">
      {/* Background blur circles */}
      <div className="absolute w-[551px] h-[551px] rounded-full bg-[#0043E0] opacity-[0.18] blur-[216px] top-[-399px] right-[9px]" />
      <div className="absolute w-[551px] h-[551px] rounded-full bg-[#0043E0] opacity-[0.22] blur-[216px] top-[815px] right-[182px]" />
      <div className="absolute w-[551px] h-[551px] rounded-full bg-[#0043E0] opacity-[0.22] blur-[216px] top-[-537px] right-[-167px]" />

      {/* Right Side - Register Panel (WHITE PANEL - should be on RIGHT in RTL) */}
      <div className="flex-1 lg:flex-none lg:w-[50%] flex items-center justify-center p-4 lg:p-[19px]">
        <div className="w-full max-w-[942px] h-[calc(100vh-38px)] bg-[#F2F3F8] rounded-[25px] p-6 lg:px-[45px] lg:pt-[15px] lg:pb-[20px] relative overflow-hidden">
          {/* Header - Logo on right side (RTL), Login link on left side */}
          <div className="flex items-center justify-between">
            <Image
              src="https://res.cloudinary.com/dimsgvsze/image/upload/v1768252856/BY_3_exro8m.png"
              alt="LeadSol Logo"
              width={150}
              height={100}
              className="h-[100px] w-auto"
              unoptimized
            />
            <p className="text-[#030733] text-[14px]">
              כבר רשום למערכת? <Link href="/login" className="text-[#0043E0] underline">התחבר</Link>
            </p>
          </div>

          {/* Title - centered */}
          <div className="mt-[25px]">
            <h1 className="text-[24px] lg:text-[28px] font-semibold text-[#030733] text-center leading-[1.4]">
              הצטרף ל-LeadSol היום!
            </h1>
            <p className="text-[#3B3B3C] text-[13px] lg:text-[15px] font-light text-center mt-[8px]">
              הכירו את הכלים המתקדמים של Leadsol והתחילו להמיר לידים באופן אוטומטי.
            </p>
          </div>

          <form onSubmit={handleRegister} className="max-w-[468px] mx-auto mt-[15px]">
            {/* Name fields - side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[15px] lg:text-[16px] text-[#030733] mb-[8px] text-right">
                  שם פרטי
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="השם שלך"
                  className="w-full h-[44px] px-4 rounded-[10px] border-[0.5px] border-[#595C7A] bg-transparent text-[#030733] placeholder-[#595C7A] text-[14px] font-light text-right outline-none focus:ring-2 focus:ring-[#0043E0] focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-[15px] lg:text-[16px] text-[#030733] mb-[8px] text-right">
                  שם משפחה
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="שם משפחה"
                  className="w-full h-[44px] px-4 rounded-[10px] border-[0.5px] border-[#595C7A] bg-transparent text-[#030733] placeholder-[#595C7A] text-[14px] font-light text-right outline-none focus:ring-2 focus:ring-[#0043E0] focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Email field */}
            <div className="mt-[12px]">
              <label className="block text-[15px] lg:text-[16px] text-[#030733] mb-[8px] text-right">
                אימייל
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="הזן את האימייל שלך"
                className="w-full h-[44px] px-4 rounded-[10px] border-[0.5px] border-[#595C7A] bg-transparent text-[#030733] placeholder-[#595C7A] text-[14px] font-light text-right outline-none focus:ring-2 focus:ring-[#0043E0] focus:border-transparent"
                dir="ltr"
                required
              />
            </div>

            {/* Password field */}
            <div className="mt-[12px]">
              <div className="flex items-center gap-2 mb-[8px]">
                <label className="text-[15px] lg:text-[16px] text-[#030733] text-right">
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
                  className="w-full h-[44px] px-4 pl-12 rounded-[10px] border-[0.5px] border-[#595C7A] bg-transparent text-[#030733] placeholder-[#595C77] text-[14px] font-light text-right outline-none focus:ring-2 focus:ring-[#0043E0] focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-[15px] top-1/2 -translate-y-1/2 text-[#030733]"
                >
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            {/* Confirm Password field */}
            <div className="mt-[12px]">
              <label className="block text-[15px] lg:text-[16px] text-[#030733] mb-[8px] text-right">
                אמת סיסמה
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="הקלד שוב את הסיסמה שלך"
                  className="w-full h-[44px] px-4 pl-12 rounded-[10px] border-[0.5px] border-[#595C7A] bg-transparent text-[#030733] placeholder-[#595C77] text-[14px] font-light text-right outline-none focus:ring-2 focus:ring-[#0043E0] focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute left-[15px] top-1/2 -translate-y-1/2 text-[#030733]"
                >
                  {showConfirmPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-2 mt-[12px] text-[13px]">
              <label className="flex items-start gap-3 cursor-pointer">
                <div className="relative flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={agreeMarketing}
                    onChange={(e) => setAgreeMarketing(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-[16px] h-[16px] rounded-[4px] border-[0.65px] border-[#030733] flex items-center justify-center ${agreeMarketing ? 'bg-[#030733]' : 'bg-transparent'}`}>
                    {agreeMarketing && (
                      <svg className="w-[8px] h-[6px]" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="0.93"/>
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-[#030733] text-right leading-[1.3] mt-[22px]">
                  אני לא רוצה לקבל מיילים שיווקיים ועדכוני מוצרים מ-Leadsol.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <div className="relative flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="sr-only"
                    required
                  />
                  <div className={`w-[16px] h-[16px] rounded-[4px] border-[0.65px] border-[#030733] flex items-center justify-center ${agreeTerms ? 'bg-[#030733]' : 'bg-transparent'}`}>
                    {agreeTerms && (
                      <svg className="w-[8px] h-[6px]" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="0.93"/>
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-[#030733] text-right leading-[1.3] mt-[22px]">
                  על ידי יצירת חשבון, אתה מסכים ל<Link href="/terms" className="text-[#0043E0] underline">תנאי השימוש</Link> ו<Link href="/privacy" className="text-[#0043E0] underline">מדיניות הפרטיות</Link> של Leadsol.
                </span>
              </label>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-2 rounded-[10px] text-[13px] text-right mt-3">
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[44px] bg-[#0043E0] text-white rounded-[10px] font-semibold text-[17px] hover:bg-[#0035b0] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-[15px]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  הרשמה
                  <svg className="w-[13px] h-[12px] rotate-90" viewBox="0 0 13 12" fill="none">
                    <path d="M10.5625 4.125L6.5 7.875L2.4375 4.125" stroke="white" strokeWidth="0.93" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="absolute bottom-[20px] left-[28px] right-[28px] flex items-center justify-between text-[13px] text-[#595C7A]">
            <div className="flex gap-6">
              <Link href="/privacy" className="font-light hover:underline">מדיניות פרטיות</Link>
              <Link href="/support" className="font-light hover:underline">תמיכה</Link>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-light">2024 LeadSol</span>
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
            width={1200}
            height={350}
            className="w-full h-auto object-cover object-top"
            unoptimized
          />
        </div>
      </div>
    </div>
  )
}
