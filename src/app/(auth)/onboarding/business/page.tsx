'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

const businessOptions = [
  { id: 'startup', label: 'עסק בתחילת דרכו' },
  { id: 'agency', label: 'סוכנות שיווק' },
  { id: 'enterprise', label: 'חברת אנטרפרייז' },
  { id: 'startup-tech', label: 'חברת סטארטאפ' },
  { id: 'freelancer', label: 'פרילנסר' },
  { id: 'ecommerce', label: 'חנות איקומרס' },
  { id: 'other', label: 'אחר' },
]

export default function OnboardingBusinessPage() {
  const router = useRouter()
  const [selectedOption, setSelectedOption] = useState<string | null>(null)

  const handleNext = () => {
    if (selectedOption) {
      localStorage.setItem('onboarding_business', selectedOption)
      router.push('/onboarding/goal')
    }
  }

  const handleSkip = () => {
    router.push('/onboarding/goal')
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
          {/* Header */}
          <div className="flex items-center justify-between">
            <Image
              src="https://res.cloudinary.com/dimsgvsze/image/upload/v1768252856/BY_3_exro8m.png"
              alt="LeadSol Logo"
              width={150}
              height={100}
              className="h-[60px] sm:h-[80px] lg:h-[100px] w-auto"
              unoptimized
            />
          </div>

          {/* Progress Bar - 4 segments, first two active */}
          <div className="flex items-center gap-[6px] sm:gap-[10px] mt-[20px] sm:mt-[30px] justify-center">
            <div className="w-[60px] sm:w-[100px] lg:w-[172px] h-[6px] sm:h-[8px] rounded-[60px] bg-[#0043E0]" />
            <div className="w-[60px] sm:w-[100px] lg:w-[172px] h-[6px] sm:h-[8px] rounded-[60px] bg-[#0043E0]" />
            <div className="w-[60px] sm:w-[100px] lg:w-[172px] h-[6px] sm:h-[8px] rounded-[60px] bg-[#D9D9D9]" />
            <div className="w-[60px] sm:w-[100px] lg:w-[172px] h-[6px] sm:h-[8px] rounded-[60px] bg-[#D9D9D9]" />
          </div>

          {/* Content */}
          <div className="flex flex-col items-center mt-[25px] sm:mt-[40px]">
            {/* Title */}
            <h1 className="text-[#030733] text-[18px] sm:text-[24px] lg:text-[35px] font-semibold text-center mb-[20px] sm:mb-[30px] leading-[1.4] px-2">
              מה הכי מתאר את העסק שלך?
            </h1>

            {/* Options Grid */}
            <div className="max-w-[600px] w-full mb-[20px] sm:mb-[30px] px-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px] sm:gap-[16px]">
                {businessOptions.slice(0, 6).map((option) => {
                  const isSelected = selectedOption === option.id
                  return (
                    <button
                      key={option.id}
                      onClick={() => setSelectedOption(option.id)}
                      className={`h-[55px] sm:h-[70px] rounded-[12px] sm:rounded-[15px] flex items-center justify-between px-[15px] sm:px-[20px] transition-all border ${
                        isSelected
                          ? 'bg-white border-[#0043E0] border-2'
                          : 'bg-white border-[#D9D9D9]'
                      }`}
                    >
                      <span className="text-[#030733] text-[14px] sm:text-[16px] font-medium">{option.label}</span>
                      <div className={`w-[20px] h-[20px] sm:w-[24px] sm:h-[24px] rounded-full border-[2px] flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'border-[#0043E0]' : 'border-[#D9D9D9]'
                      }`}>
                        {isSelected && (
                          <div className="w-[10px] h-[10px] sm:w-[12px] sm:h-[12px] rounded-full bg-[#0043E0]" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
              {/* Last item (אחר) centered */}
              <div className="flex justify-center mt-[12px] sm:mt-[16px]">
                <button
                  onClick={() => setSelectedOption('other')}
                  className={`h-[55px] sm:h-[70px] w-full sm:max-w-[200px] rounded-[12px] sm:rounded-[15px] flex items-center justify-between px-[15px] sm:px-[20px] transition-all border ${
                    selectedOption === 'other'
                      ? 'bg-white border-[#0043E0] border-2'
                      : 'bg-white border-[#D9D9D9]'
                  }`}
                >
                  <span className="text-[#030733] text-[14px] sm:text-[16px] font-medium">אחר</span>
                  <div className={`w-[20px] h-[20px] sm:w-[24px] sm:h-[24px] rounded-full border-[2px] flex items-center justify-center ${
                    selectedOption === 'other' ? 'border-[#0043E0]' : 'border-[#D9D9D9]'
                  }`}>
                    {selectedOption === 'other' && (
                      <div className="w-[10px] h-[10px] sm:w-[12px] sm:h-[12px] rounded-full bg-[#0043E0]" />
                    )}
                  </div>
                </button>
              </div>
            </div>

            {/* Next Button */}
            <button
              onClick={handleNext}
              disabled={!selectedOption}
              className="w-full max-w-[300px] sm:max-w-[367px] h-[44px] sm:h-[49px] bg-[#0043E0] text-white rounded-[10px] font-semibold text-[16px] sm:text-[18px] hover:bg-[#0035b0] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              הבא
              <svg className="w-[12px] h-[13px] rotate-180" viewBox="0 0 12 13" fill="none">
                <path d="M7.875 10.5625L4.125 6.5L7.875 2.4375" stroke="white" strokeWidth="0.93" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Skip Link */}
            <button
              onClick={handleSkip}
              className="text-[#595C7A] text-[14px] sm:text-[16px] underline mt-[15px] sm:mt-[20px] hover:no-underline"
            >
              דלג
            </button>
          </div>

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

        {/* Preview Image */}
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
