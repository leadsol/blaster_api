'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function VerifyEmailPage() {
  const router = useRouter()
  const [code, setCode] = useState(['', '', '', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState('')
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [email, setEmail] = useState('')
  const [resendSuccess, setResendSuccess] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    // Get email from localStorage
    const pendingEmail = localStorage.getItem('pendingVerificationEmail')
    if (pendingEmail) {
      setEmail(pendingEmail)
    } else {
      // No email found, redirect to register
      router.push('/register')
    }
    // Focus first input on mount
    inputRefs.current[0]?.focus()
  }, [router])

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 8).split('')
      const newCode = [...code]
      digits.forEach((digit, i) => {
        if (index + i < 8) {
          newCode[index + i] = digit
        }
      })
      setCode(newCode)
      const nextIndex = Math.min(index + digits.length, 7)
      inputRefs.current[nextIndex]?.focus()
    } else {
      const newCode = [...code]
      newCode[index] = value.replace(/\D/g, '')
      setCode(newCode)

      // Auto-focus next input
      if (value && index < 7) {
        inputRefs.current[index + 1]?.focus()
      }
    }
    setError('')
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleVerify = async () => {
    const fullCode = code.join('')
    if (fullCode.length !== 8) {
      setError('נא להזין קוד בן 8 ספרות')
      return
    }

    if (!email) {
      setError('לא נמצא אימייל לאימות')
      return
    }

    setLoading(true)
    setError('')

    try {
      const supabase = createClient()

      // Verify the OTP code
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: fullCode,
        type: 'email',
      })

      if (verifyError) {
        // Handle specific error messages
        if (verifyError.message.includes('expired')) {
          setError('הקוד פג תוקף. אנא בקש קוד חדש.')
        } else if (verifyError.message.includes('Invalid') || verifyError.message.includes('invalid')) {
          setError('קוד שגוי. אנא נסה שוב.')
        } else {
          setError(verifyError.message)
        }
        setLoading(false)
        return
      }

      if (data.user) {
        // Get stored password and set it for the user
        const pendingData = localStorage.getItem('pendingUserData')
        if (pendingData) {
          const { password } = JSON.parse(pendingData)
          if (password) {
            await supabase.auth.updateUser({ password })
          }
        }

        // Successfully verified!
        setVerified(true)
        setLoading(false)

        // Clean up localStorage
        localStorage.removeItem('pendingVerificationEmail')
        localStorage.removeItem('pendingUserData')

        // Redirect after showing success message
        setTimeout(() => {
          router.push('/onboarding/leads')
        }, 2000)
      }
    } catch (err) {
      setError('אירעה שגיאה. אנא נסה שוב.')
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!email || resendCooldown > 0) return

    setResending(true)
    setError('')
    setResendSuccess(false)

    try {
      const supabase = createClient()

      // Resend the OTP using signInWithOtp
      const { error: resendError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      })

      if (resendError) {
        setError(resendError.message)
      } else {
        // Start cooldown and show success
        setResendCooldown(60)
        setResendSuccess(true)
        setTimeout(() => setResendSuccess(false), 5000)
      }
    } catch (err) {
      setError('אירעה שגיאה בשליחת הקוד. אנא נסה שוב.')
    }

    setResending(false)
  }

  // Auto-submit when all digits entered
  useEffect(() => {
    if (code.every(digit => digit !== '') && !loading && !verified) {
      handleVerify()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, loading, verified])

  return (
    <div className="min-h-screen flex bg-[#030733] relative overflow-hidden" dir="rtl">
      {/* Background blur circles */}
      <div className="absolute w-[551px] h-[551px] rounded-full bg-[#0043E0] opacity-[0.18] blur-[216px] top-[-399px] right-[9px]" />
      <div className="absolute w-[551px] h-[551px] rounded-full bg-[#0043E0] opacity-[0.22] blur-[216px] top-[815px] right-[182px]" />
      <div className="absolute w-[551px] h-[551px] rounded-full bg-[#0043E0] opacity-[0.22] blur-[216px] top-[-537px] right-[-167px]" />

      {/* Right Side - Form Panel */}
      <div className="flex-1 lg:flex-none lg:w-[50%] flex items-center justify-center p-4 lg:p-[19px]">
        <div className="w-full max-w-[942px] h-[calc(100vh-38px)] bg-[#F2F3F8] rounded-[25px] p-6 lg:px-[45px] lg:pt-[15px] lg:pb-[25px] relative overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between">
            <img
              src="https://res.cloudinary.com/dimsgvsze/image/upload/v1768252856/BY_3_exro8m.png"
              alt="LeadSol Logo"
              className="h-[60px] sm:h-[80px] lg:h-[100px] w-auto"
            />
            <p className="text-[#030733] text-[12px] sm:text-[16px]">
              כבר רשום למערכת? <Link href="/login" className="text-[#0043E0] underline">התחבר</Link>
            </p>
          </div>

          {!verified ? (
            /* Code Entry State */
            <div className="flex flex-col items-center justify-center mt-[50px] sm:mt-[80px] lg:mt-[100px] px-2">
              <h1 className="text-[22px] sm:text-[28px] lg:text-[35px] font-semibold text-[#030733] text-center leading-[1.4] mb-[8px]">
                בדוק את תיבת הדואר שלך
              </h1>
              <p className="text-[#3B3B3C] text-[14px] sm:text-[16px] lg:text-[18px] font-light text-center max-w-[555px]">
                שלחנו קוד אימות לכתובת {email || 'your@email.com'}<br />
                אנא הזן את הקוד בן 8 ספרות שקיבלת.
              </p>

              {/* 8-digit Code Input */}
              <div className="flex justify-center gap-[4px] sm:gap-[8px] mt-[20px] sm:mt-[30px]" dir="ltr">
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className={`w-[36px] h-[44px] sm:w-[44px] sm:h-[50px] lg:w-[50px] lg:h-[55px] text-center text-[16px] sm:text-[18px] lg:text-[20px] font-semibold border-[0.5px] rounded-[8px] sm:rounded-[10px] focus:ring-2 focus:ring-[#0043E0] focus:border-transparent outline-none transition-colors bg-transparent text-[#030733] ${
                      error ? 'border-red-500' : 'border-[#595C7A]'
                    }`}
                  />
                ))}
              </div>

              {error && (
                <p className="text-red-500 text-[12px] sm:text-[14px] text-center mt-3 sm:mt-4">{error}</p>
              )}

              {resendSuccess && (
                <p className="text-green-600 text-[12px] sm:text-[14px] text-center mt-3 sm:mt-4">קוד אימות חדש נשלח לאימייל שלך!</p>
              )}

              {loading && (
                <div className="flex items-center justify-center gap-2 mt-4 sm:mt-6">
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-[#0043E0]" />
                  <span className="text-[#030733] text-[12px] sm:text-[14px]">מאמת...</span>
                </div>
              )}

              {/* Resend message */}
              <div className="text-center mt-[25px] sm:mt-[40px] max-w-[435px] px-2">
                <p className="text-[#030733] text-[12px] sm:text-[14px]">
                  לא קיבלת את ההודעה? בדוק את תיקיית הספאם או נסה לשלוח מחדש.
                </p>
                <button
                  onClick={handleResend}
                  disabled={resending || resendCooldown > 0}
                  className="text-[#0043E0] text-[12px] sm:text-[14px] underline hover:no-underline mt-1 disabled:opacity-50"
                >
                  {resending ? (
                    'שולח...'
                  ) : resendCooldown > 0 ? (
                    `שלח שוב (${resendCooldown} שניות)`
                  ) : (
                    'שלח שוב את קוד האימות'
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Success State */
            <div className="flex flex-col items-center justify-center mt-[50px] sm:mt-[80px] lg:mt-[100px] px-2">
              <h1 className="text-[22px] sm:text-[28px] lg:text-[35px] font-semibold text-[#030733] text-center leading-[1.4] mb-[8px]">
                האימייל שלך אומת!
              </h1>
              <p className="text-[#3B3B3C] text-[14px] sm:text-[16px] lg:text-[18px] font-light text-center max-w-[555px]">
                ברוך הבא ל-Leadsol — כלי האוטומציה ללידים שלך מוכנים לשימוש.
              </p>

              {/* Success checkmark circle */}
              <div className="w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] lg:w-[134px] lg:h-[134px] bg-[#030733] rounded-full flex items-center justify-center mt-[30px] sm:mt-[40px]">
                <svg className="w-[40px] h-[30px] sm:w-[50px] sm:h-[38px] lg:w-[57px] lg:h-[43px]" viewBox="0 0 57 43" fill="none">
                  <path d="M3.09375 24.6938L17.4937 39.0938L35.4937 21.0938L53.4937 3.09375" stroke="#F2F3F8" strokeWidth="6.19" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="absolute bottom-[20px] sm:bottom-[30px] left-[16px] sm:left-[28px] right-[16px] sm:right-[28px] flex items-center justify-between text-[12px] sm:text-[16px] text-[#595C7A]">
            <div className="flex gap-3 sm:gap-6">
              <Link href="/privacy" className="font-light hover:underline">מדיניות פרטיות</Link>
              <Link href="/support" className="font-light hover:underline">תמיכה</Link>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] sm:text-[14px] font-light">2024 LeadSol</span>
              <span className="text-[8px] sm:text-[10.67px]">©</span>
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
