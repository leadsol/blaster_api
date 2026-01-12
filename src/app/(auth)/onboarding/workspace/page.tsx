'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Workspace {
  id: string
  name: string
  description: string
  icon: 'blaster' | 'lead' | 'bot'
  available: boolean
}

const workspaces: Workspace[] = [
  {
    id: 'blaster',
    name: 'Blaster API',
    description: 'העלה. הפץ. צור מעורבות. שלח הודעות לאלפי נמענים בלחיצה אחת.',
    icon: 'blaster',
    available: true,
  },
  {
    id: 'lead',
    name: 'Lead API',
    description: 'הפוך מענה בהודעות וואטסאפ לאוטומטי לכל טופס שממלאים – מיידית.',
    icon: 'lead',
    available: false,
  },
  {
    id: 'bot',
    name: 'Bot API',
    description: 'הפוך מענה בהודעות וואטסאפ לאוטומטי לכל טופס שממלאים – מיידית.',
    icon: 'bot',
    available: false,
  },
]

// Blaster icon - megaphone in star badge
const BlasterIcon = () => (
  <div className="w-[34px] h-[34px] relative overflow-hidden rounded-[5.67px]" style={{ background: 'linear-gradient(136deg, #2E67EE 0%, #0043E0 48%, #1A58E9 69%, #3B72F4 100%)' }}>
    <svg className="absolute" style={{ left: '3.25px', top: '2.70px' }} width="28" height="29" viewBox="0 0 23 25" fill="none">
      <path d="M11.0024 0.180539C11.2795 -0.0601796 11.6916 -0.0601796 11.9687 0.180539L14.3608 2.25869C14.5115 2.38964 14.709 2.45379 14.9079 2.43646L18.0647 2.16126C18.4304 2.12938 18.7637 2.37158 18.8465 2.72921L19.5602 5.81653C19.6052 6.01107 19.7271 6.17902 19.8983 6.28192L22.614 7.91479C22.9286 8.10394 23.0559 8.49583 22.9125 8.83375L21.6754 11.7509C21.5974 11.9349 21.5974 12.1424 21.6754 12.3263L22.9125 15.2435C23.0559 15.5814 22.9286 15.9733 22.614 16.1625L19.8983 17.7953C19.7271 17.8982 19.6052 18.0661 19.5602 18.2607L18.8465 21.348C18.7637 21.7057 18.4304 21.9479 18.0647 21.916L14.9079 21.6408C14.709 21.6234 14.5115 21.6876 14.3608 21.8185L11.9687 23.8967C11.6916 24.1374 11.2795 24.1374 11.0024 23.8967L8.6103 21.8185C8.45957 21.6876 8.26213 21.6234 8.0632 21.6408L4.90641 21.916C4.54074 21.9479 4.20739 21.7057 4.12471 21.348L3.41093 18.2607C3.36596 18.0661 3.24393 17.8982 3.0728 17.7953L0.357166 16.1625C0.0425844 15.9733 -0.0847485 15.5814 0.05857 15.2435L1.2958 12.3263C1.37375 12.1424 1.37375 11.9349 1.2958 11.7509L0.05857 8.83375C-0.0847485 8.49583 0.0425844 8.10394 0.357166 7.91479L3.0728 6.28192C3.24393 6.17902 3.36596 6.01107 3.41093 5.81653L4.12471 2.72921C4.20739 2.37158 4.54074 2.12938 4.90641 2.16126L8.0632 2.43646C8.26213 2.45379 8.45957 2.38964 8.6103 2.25869L11.0024 0.180539Z" fill="white"/>
    </svg>
    <svg className="absolute" style={{ left: '8.5px', top: '8.5px' }} width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M8.44039 2.17263C7.06805 2.72193 5.60308 3.00284 4.12489 3.00013H3.74989C3.09126 2.99918 2.45634 3.24585 1.9711 3.69121C1.48587 4.13657 1.18579 4.74807 1.1304 5.40437C1.07501 6.06067 1.26836 6.71381 1.67209 7.23419C2.07582 7.75458 2.66041 8.10418 3.30989 8.21363C3.4754 8.891 3.70614 9.55075 3.99889 10.1836C4.23089 10.6856 4.83589 10.8436 5.28989 10.5816L5.61839 10.3921C6.05839 10.1381 6.20089 9.59563 6.00439 9.15813C5.88628 8.89574 5.78148 8.62757 5.69039 8.35463C6.64939 8.48363 7.57039 8.72963 8.44039 9.07763C8.81214 7.96457 9.00109 6.79863 8.99989 5.62513C8.99989 4.41813 8.80339 3.25763 8.44039 2.17263ZM9.12989 1.87013C9.5417 3.07917 9.75118 4.34788 9.74989 5.62513C9.75128 6.98819 9.51264 8.34084 9.04489 9.62113C9.02795 9.66739 9.02029 9.71653 9.02234 9.76575C9.02439 9.81497 9.03611 9.8633 9.05684 9.90799C9.07757 9.95268 9.1069 9.99285 9.14316 10.0262C9.17941 10.0596 9.22188 10.0854 9.26814 10.1024C9.3144 10.1193 9.36354 10.127 9.41276 10.1249C9.46198 10.1229 9.51031 10.1112 9.555 10.0904C9.59969 10.0697 9.63986 10.0404 9.67321 10.0041C9.70656 9.96785 9.73245 9.92539 9.74939 9.87913C10.1285 8.84408 10.3664 7.7627 10.4569 6.66413C10.7255 6.38498 10.8753 6.01252 10.8749 5.62513C10.8749 5.22163 10.7154 4.85513 10.4569 4.58613C10.3659 3.48765 10.1279 2.40634 9.74939 1.37113C9.73245 1.32487 9.70656 1.2824 9.67321 1.24615C9.63986 1.20989 9.59969 1.18056 9.555 1.15983C9.46475 1.11797 9.36156 1.11367 9.26814 1.14788C9.17472 1.18209 9.09871 1.25201 9.05684 1.34227C9.01498 1.43252 9.01068 1.53571 9.04489 1.62913C9.07439 1.70913 9.10289 1.78913 9.12989 1.87013Z" fill="#0043E0"/>
    </svg>
  </div>
)

// Lead icon - checkmark in star badge
const LeadIcon = () => (
  <div className="w-[34px] h-[34px] relative overflow-hidden rounded-[5.67px]" style={{ background: 'linear-gradient(136deg, #2E67EE 0%, #0043E0 48%, #1A58E9 69%, #3B72F4 100%)' }}>
    <svg className="absolute" style={{ left: '2.27px', top: '2.27px' }} width="30" height="30" viewBox="0 0 30 30" fill="none">
      <path d="M14.2505 2.87585C14.5276 2.63513 14.9396 2.63513 15.2167 2.87585L17.6088 4.954C17.7596 5.08496 17.957 5.14911 18.1559 5.13177L21.3128 4.85658C21.6784 4.82469 22.0118 5.06689 22.0945 5.42452L22.8082 8.51184C22.8533 8.70638 22.9752 8.87433 23.1463 8.97723L25.8621 10.6101C26.1766 10.7993 26.3039 11.1911 26.1605 11.5291L24.9234 14.4463C24.8455 14.6302 24.8455 14.8377 24.9234 15.0216L26.1605 17.9388C26.3039 18.2767 26.1766 18.6686 25.8621 18.8578L23.1463 20.4906C22.9752 20.5935 22.8533 20.7615 22.8082 20.9561L22.0945 24.0433C22.0118 24.401 21.6784 24.6432 21.3128 24.6113L18.1559 24.3361C17.957 24.3187 17.7596 24.3829 17.6088 24.5138L15.2167 26.5921C14.9396 26.8327 14.5276 26.8327 14.2505 26.5921L11.8583 24.5138C11.7076 24.3829 11.5102 24.3187 11.3112 24.3361L8.15446 24.6113C7.78879 24.6432 7.45544 24.401 7.37276 24.0433L6.65898 20.9561C6.614 20.7615 6.49198 20.5935 6.32085 20.4906L3.60521 18.8578C3.29063 18.6686 3.1633 18.2767 3.30662 17.9388L4.54385 15.0216C4.6218 14.8377 4.6218 14.6302 4.54385 14.4463L3.30662 11.5291C3.1633 11.1911 3.29063 10.7993 3.60521 10.6101L6.32085 8.97723C6.49198 8.87433 6.614 8.70638 6.65898 8.51184L7.37276 5.42452C7.45544 5.06689 7.78879 4.82469 8.15446 4.85658L11.3112 5.13177C11.5102 5.14911 11.7076 5.08496 11.8583 4.954L14.2505 2.87585Z" fill="white"/>
      <path d="M11.0508 15.9607L13.5063 18.4162L16.5758 15.3468L19.6452 12.2773" stroke="#0043E0" strokeWidth="1.05498" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
)

// Bot icon - robot face
const BotIcon = () => (
  <div className="w-[34px] h-[34px] relative overflow-hidden rounded-[5.67px] flex items-center justify-center" style={{ background: 'linear-gradient(136deg, #2E67EE 0%, #0043E0 48%, #1A58E9 69%, #3B72F4 100%)' }}>
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M12.255 3.59375H7.745C5.45232 3.59375 3.59375 5.45232 3.59375 7.745V12.255C3.59375 14.5477 5.45232 16.4062 7.745 16.4062H12.255C14.5477 16.4062 16.4062 14.5477 16.4062 12.255V7.745C16.4062 5.45232 14.5477 3.59375 12.255 3.59375Z" stroke="white"/>
      <path d="M16.3379 12.9889H17.6875C17.914 12.9889 18.1313 12.8989 18.2915 12.7388C18.4516 12.5786 18.5416 12.3613 18.5416 12.1348V7.86393C18.5416 7.63739 18.4516 7.42013 18.2915 7.25994C18.1313 7.09976 17.914 7.00977 17.6875 7.00977H16.3379" stroke="white"/>
      <path d="M3.66273 12.9889H2.31315C2.08661 12.9889 1.86935 12.8989 1.70917 12.7388C1.54898 12.5786 1.45898 12.3613 1.45898 12.1348V7.86393C1.45898 7.63739 1.54898 7.42013 1.70917 7.25994C1.86935 7.09976 2.08661 7.00977 2.31315 7.00977H3.66273" stroke="white"/>
      <path d="M2.30273 7.01042V3.59375" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17.6883 7.01042L17.6797 3.59375" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8.2832 12.9902H11.6998" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6.56641 9.14517L7.42057 8.29102L8.27474 9.14517" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11.6914 9.14517L12.5456 8.29102L13.3997 9.14517" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
)

export default function ChooseWorkspacePage() {
  const router = useRouter()
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>('blaster')

  const handleConnect = (workspaceId: string) => {
    const workspace = workspaces.find(w => w.id === workspaceId)
    if (workspace?.available) {
      localStorage.setItem('workspace', workspaceId)
      router.push('/chat')
    }
  }

  const getIcon = (icon: string) => {
    switch (icon) {
      case 'blaster':
        return <BlasterIcon />
      case 'lead':
        return <LeadIcon />
      case 'bot':
        return <BotIcon />
      default:
        return <BlasterIcon />
    }
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
          {/* Header - Logo */}
          <div className="flex items-center justify-between">
            <img
              src="https://res.cloudinary.com/dimsgvsze/image/upload/v1768252856/BY_3_exro8m.png"
              alt="LeadSol Logo"
              className="h-[60px] sm:h-[80px] lg:h-[100px] w-auto"
            />
          </div>

          {/* Content */}
          <div className="mt-[25px] sm:mt-[40px] max-w-[615px] mx-auto px-2">
            <h1 className="text-[18px] sm:text-[24px] lg:text-[35px] font-semibold text-[#030733] text-center leading-[1.4]">
              בחר את סביבת העבודה שלך
            </h1>
            <p className="text-[#3B3B3C] text-[12px] sm:text-[14px] lg:text-[18px] font-light text-center mt-[8px] sm:mt-[10px]">
              בחר את האפליקציה שאתה רוצה לעבוד איתה היום
            </p>

            {/* Workspace Options */}
            <div className="mt-[20px] sm:mt-[30px] space-y-[10px] sm:space-y-[12px]">
              {workspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className={`relative w-full min-h-[65px] sm:min-h-[75px] bg-white rounded-[10px] flex items-center px-[12px] sm:px-[15px] py-3 sm:py-0 ${
                    workspace.available ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => workspace.available && setSelectedWorkspace(workspace.id)}
                >
                  {/* Coming Soon Badge - for unavailable */}
                  {!workspace.available && (
                    <div className="absolute left-[12px] sm:left-[23px] top-1/2 -translate-y-1/2 bg-[rgba(55,55,55,0.22)] text-[#030733] text-[10px] sm:text-[12px] font-light px-[10px] sm:px-[14px] py-[4px] sm:py-[6px] rounded-full">
                      בקרוב
                    </div>
                  )}

                  {/* Connect Button - for available */}
                  {workspace.available && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleConnect(workspace.id)
                      }}
                      className="absolute left-[10px] sm:left-[15px] top-1/2 -translate-y-1/2 w-[70px] sm:w-[98px] h-[38px] sm:h-[49px] bg-[#0043E0] text-white text-[13px] sm:text-[16px] font-semibold rounded-[8px] sm:rounded-[10px] hover:bg-[#0035b0] transition-colors flex items-center justify-center gap-1 sm:gap-2"
                    >
                      התחבר
                      <svg className="w-[9px] h-[10px] sm:w-[11px] sm:h-[12px]" viewBox="0 0 11 12" fill="none">
                        <path d="M7.21875 9.75L3.78125 6L7.21875 2.25" stroke="white" strokeWidth="0.926849" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}

                  {/* Icon - positioned on the right */}
                  <div className="absolute right-[12px] sm:right-[20px] top-1/2 -translate-y-1/2">
                    {getIcon(workspace.icon)}
                  </div>

                  {/* Text Content */}
                  <div className="absolute right-[52px] sm:right-[68px] left-[85px] sm:left-[130px] top-1/2 -translate-y-1/2">
                    <h3 className="font-semibold text-[14px] sm:text-[16px] text-[#030733] text-right">
                      {workspace.name}
                    </h3>
                    <p className="text-[11px] sm:text-[14px] font-light text-[#595C77] text-right mt-[1px] sm:mt-[2px] line-clamp-2">
                      {workspace.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="absolute bottom-[20px] sm:bottom-[30px] left-[16px] sm:left-[28px] right-[16px] sm:right-[28px] flex items-center justify-between text-[12px] sm:text-[14px] text-[#595C7A]">
            <div className="flex gap-3 sm:gap-6">
              <Link href="/privacy" className="font-light hover:underline">מדיניות פרטיות</Link>
              <Link href="/support" className="font-light hover:underline">תמיכה</Link>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] sm:text-[12px] font-light">2024 LeadSol</span>
              <span className="text-[8px] sm:text-[10px]">©</span>
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
