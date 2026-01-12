'use client'

import { useState } from 'react'
import { Check, Zap, Crown, Building2, HelpCircle } from 'lucide-react'

const plans = [
  {
    id: 'free',
    name: 'חינם',
    price: 0,
    period: 'לנצח',
    description: 'מושלם להתחלה ולהכרת המערכת',
    features: [
      'עד 100 הודעות בחודש',
      'חיבור WhatsApp אחד',
      'צ\'אט בסיסי',
      'תמיכה במייל',
    ],
    cta: 'התחל בחינם',
    popular: false,
    icon: Zap,
  },
  {
    id: 'starter',
    name: 'מתחברים',
    price: 49.90,
    period: 'לחודש',
    description: 'לעסקים קטנים שרוצים לצמוח',
    features: [
      'עד 1,000 הודעות בחודש',
      'עד 2 חיבורי WhatsApp',
      'קמפיינים ללא הגבלה',
      'Text Spinning',
      'תמיכה בצ\'אט',
      'דוחות בסיסיים',
    ],
    cta: 'בחר חבילה',
    popular: false,
    icon: Zap,
  },
  {
    id: 'pro',
    name: 'פרו עסקים',
    price: 69.90,
    period: 'לחודש',
    description: 'לעסקים שרוצים את המקסימום',
    features: [
      'עד 5,000 הודעות בחודש',
      'עד 5 חיבורי WhatsApp',
      'קמפיינים ללא הגבלה',
      'Text Spinning מתקדם',
      'בוט אוטומטי',
      'API גישה מלאה',
      'תמיכה בטלפון',
      'דוחות מתקדמים',
    ],
    cta: 'בחר חבילה',
    popular: true,
    icon: Crown,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    period: 'בהתאמה אישית',
    description: 'לארגונים גדולים עם צרכים מיוחדים',
    features: [
      'הודעות ללא הגבלה',
      'חיבורים ללא הגבלה',
      'מנהל לקוח ייעודי',
      'SLA מובטח',
      'התאמות אישיות',
      'הדרכה צוותית',
      'תמיכה 24/7',
      'White Label',
    ],
    cta: 'צור קשר',
    popular: false,
    icon: Building2,
  },
]

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')

  return (
    <div className="p-3 sm:p-4 lg:p-6 h-full overflow-y-auto" dir="rtl">
      {/* Header */}
      <div className="text-center mb-6 sm:mb-8 lg:mb-12">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2 sm:mb-4">התמחורים שלנו</h1>
        <p className="text-xs sm:text-sm lg:text-base text-gray-500 max-w-2xl mx-auto px-2">
          אנו מציעים מגוון חבילות והתאמות לכל צורך. בחר את החבילה המתאימה לך ביותר.
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mt-4 sm:mt-6 lg:mt-8">
          <span className={`text-xs sm:text-sm ${billingPeriod === 'monthly' ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
            חודשי
          </span>
          <button
            onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
            className={`relative w-12 sm:w-14 h-6 sm:h-7 rounded-full transition-colors ${
              billingPeriod === 'yearly' ? 'bg-[#25D366]' : 'bg-gray-300'
            }`}
          >
            <div className={`absolute top-1 w-4 sm:w-5 h-4 sm:h-5 bg-white rounded-full shadow transition-transform ${
              billingPeriod === 'yearly' ? 'right-1' : 'left-1'
            }`} />
          </button>
          <span className={`text-xs sm:text-sm flex items-center gap-1 ${billingPeriod === 'yearly' ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
            שנתי
            <span className="bg-green-100 text-green-700 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
              חסוך 20%
            </span>
          </span>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 max-w-7xl mx-auto">
        {plans.map((plan) => {
          const Icon = plan.icon
          const yearlyPrice = plan.price ? plan.price * 12 * 0.8 : null
          const displayPrice = billingPeriod === 'yearly' && yearlyPrice
            ? (yearlyPrice / 12).toFixed(2)
            : plan.price?.toFixed(2)

          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-xl sm:rounded-2xl border-2 p-4 sm:p-5 lg:p-6 flex flex-col ${
                plan.popular ? 'border-[#1e3a5f] shadow-lg' : 'border-gray-200'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1e3a5f] text-white text-[10px] sm:text-xs font-medium px-3 sm:px-4 py-1 rounded-full whitespace-nowrap">
                  הכי פופולרי
                </div>
              )}

              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center ${
                  plan.popular ? 'bg-[#1e3a5f] text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm sm:text-base">{plan.name}</h3>
              </div>

              <div className="mb-3 sm:mb-4">
                {plan.price !== null ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">{displayPrice}</span>
                      <span className="text-gray-500 text-sm">₪</span>
                    </div>
                    <span className="text-xs sm:text-sm text-gray-500">{plan.period}</span>
                  </>
                ) : (
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">מותאם אישית</div>
                )}
              </div>

              <p className="text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">{plan.description}</p>

              <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6 lg:mb-8 flex-1">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm">
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#25D366] flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-2 sm:py-2.5 lg:py-3 rounded-lg font-medium transition-colors text-sm sm:text-base ${
                  plan.popular
                    ? 'bg-[#1e3a5f] text-white hover:bg-[#2a4a73]'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          )
        })}
      </div>

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto mt-8 sm:mt-12 lg:mt-16 px-1">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 text-center mb-4 sm:mb-6 lg:mb-8">שאלות נפוצות</h2>
        <div className="space-y-3 sm:space-y-4">
          {[
            {
              q: 'האם אני יכול לשדרג או לשנמך חבילה?',
              a: 'כן, ניתן לשדרג או לשנמך חבילה בכל עת. השינוי יחושב באופן יחסי.',
            },
            {
              q: 'מה קורה אם אני חורג מהמכסה?',
              a: 'תקבל התראה כשתגיע ל-80% מהמכסה. אם תחרוג, תוכל לרכוש הודעות נוספות או לשדרג חבילה.',
            },
            {
              q: 'האם יש התחייבות לתקופה?',
              a: 'לא, אין התחייבות. תוכל לבטל בכל עת ללא קנסות.',
            },
            {
              q: 'באילו אמצעי תשלום ניתן לשלם?',
              a: 'אנו מקבלים כרטיסי אשראי, PayPal, והעברה בנקאית לחבילות Enterprise.',
            },
          ].map((faq, index) => (
            <div key={index} className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-3 sm:p-4 lg:p-5">
              <div className="flex items-start gap-2 sm:gap-3">
                <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#1e3a5f] flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base">{faq.q}</h3>
                  <p className="text-xs sm:text-sm text-gray-500">{faq.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center mt-8 sm:mt-12 lg:mt-16 bg-gradient-to-r from-[#1e3a5f] to-[#2a4a73] rounded-xl sm:rounded-2xl p-6 sm:p-8 lg:p-12 max-w-4xl mx-auto">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-2 sm:mb-4">עדיין לא בטוח?</h2>
        <p className="text-white/80 mb-4 sm:mb-6 lg:mb-8 text-xs sm:text-sm lg:text-base">נשמח לעזור לך לבחור את החבילה המתאימה ביותר לעסק שלך</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
          <button className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 bg-white text-[#1e3a5f] rounded-lg font-medium hover:bg-gray-100 transition-colors text-sm sm:text-base">
            דבר איתנו
          </button>
          <button className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 border border-white/30 text-white rounded-lg font-medium hover:bg-white/10 transition-colors text-sm sm:text-base">
            נסה חינם
          </button>
        </div>
      </div>
    </div>
  )
}
