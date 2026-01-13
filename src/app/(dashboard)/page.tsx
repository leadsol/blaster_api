'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Plus, MoreVertical, Calendar, Users, MessageSquare, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'

interface Campaign {
  id: string
  name: string
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed'
  scheduled_at: string | null
  total_recipients: number
  sent_count: number
  delivered_count: number
  read_count: number
  failed_count: number
  reply_count: number
  created_at: string
  contact_lists?: { name: string } | null
}

interface CampaignStats {
  totalSent: number
  avgResponseTime: string
  sendingDuration: string
}

const statusLabels: Record<string, string> = {
  draft: 'טיוטה',
  scheduled: 'מתוזמן',
  running: 'פעיל',
  paused: 'מושהה',
  completed: 'הושלם',
  failed: 'נכשל',
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  running: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCampaigns()

    // Set up realtime subscription for campaigns
    const supabase = createClient()

    const campaignsChannel = supabase
      .channel('campaigns-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaigns'
        },
        (payload) => {
          console.log('[REALTIME] Campaign change:', payload)
          if (payload.eventType === 'INSERT') {
            setCampaigns(prev => [payload.new as Campaign, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setCampaigns(prev => prev.map(c =>
              c.id === payload.new.id ? { ...c, ...payload.new } as Campaign : c
            ))
            // Update selected campaign if it's the one that changed
            setSelectedCampaign(prev =>
              prev?.id === payload.new.id ? { ...prev, ...payload.new } as Campaign : prev
            )
          } else if (payload.eventType === 'DELETE') {
            setCampaigns(prev => prev.filter(c => c.id !== payload.old.id))
            setSelectedCampaign(prev => prev?.id === payload.old.id ? null : prev)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(campaignsChannel)
    }
  }, [])

  const loadCampaigns = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('campaigns')
      .select('*, contact_lists(name)')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setCampaigns(data)
      if (data.length > 0) {
        setSelectedCampaign(data[0])
      }
    }
    setLoading(false)
  }

  const filteredCampaigns = campaigns.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const stats: CampaignStats = selectedCampaign ? {
    totalSent: selectedCampaign.sent_count,
    avgResponseTime: '-',
    sendingDuration: '-',
  } : {
    totalSent: 0,
    avgResponseTime: '-',
    sendingDuration: '-',
  }

  // Recipients will be loaded from database when campaign is selected
  const [recipients, setRecipients] = useState<Array<{ id: string; name: string; phone: string; status: string; time: string }>>([])

  // Load recipients when campaign is selected with realtime updates
  useEffect(() => {
    if (!selectedCampaign) {
      setRecipients([])
      return
    }

    const loadRecipients = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('campaign_messages')
        .select('*')
        .eq('campaign_id', selectedCampaign.id)
        .order('created_at', { ascending: true })
        .limit(50)

      if (!error && data) {
        setRecipients(data.map((r: any) => ({
          id: r.id,
          name: r.name || 'ללא שם',
          phone: r.phone || '',
          status: r.status || 'pending',
          time: r.sent_at ? format(new Date(r.sent_at), 'HH:mm', { locale: he }) : '-',
        })))
      }
    }

    loadRecipients()

    // Set up realtime subscription for campaign messages
    const supabase = createClient()
    const messagesChannel = supabase
      .channel(`campaign-messages-${selectedCampaign.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaign_messages',
          filter: `campaign_id=eq.${selectedCampaign.id}`
        },
        (payload) => {
          console.log('[REALTIME] Message change:', payload)
          if (payload.eventType === 'UPDATE') {
            setRecipients(prev => prev.map(r =>
              r.id === payload.new.id
                ? {
                    ...r,
                    status: payload.new.status,
                    time: payload.new.sent_at ? format(new Date(payload.new.sent_at), 'HH:mm', { locale: he }) : r.time,
                  }
                : r
            ))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(messagesChannel)
    }
  }, [selectedCampaign?.id])

  return (
    <div className="p-3 sm:p-4 lg:p-6 h-full overflow-y-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="חפש קמפיינים לפי שם..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 pl-4 py-2 border border-gray-200 rounded-lg bg-white/5 text-white placeholder-gray-400 w-full sm:w-60 lg:w-80 focus:outline-none focus:ring-2 focus:ring-[#25D366]"
            />
          </div>
          <select className="px-4 py-2 border border-gray-200 rounded-lg bg-white/5 text-white focus:outline-none">
            <option value="">חיבור</option>
          </select>
        </div>
        <Link
          href="/campaigns/new"
          className="flex items-center justify-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-lg hover:bg-[#20bd5a] transition-colors w-full sm:w-auto text-sm sm:text-base"
        >
          <Plus className="w-5 h-5" />
          <span>צור קמפיין חדש</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Campaigns List */}
        <div className="lg:col-span-5 bg-white/5 rounded-xl overflow-hidden">
          <div className="max-h-[400px] lg:max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-400">טוען...</div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>אין קמפיינים עדיין</p>
                <Link href="/campaigns/new" className="text-[#25D366] hover:underline mt-2 block">
                  צור קמפיין ראשון
                </Link>
              </div>
            ) : (
              filteredCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  onClick={() => setSelectedCampaign(campaign)}
                  className={`p-4 border-b border-white/10 cursor-pointer transition-colors ${
                    selectedCampaign?.id === campaign.id
                      ? 'bg-[#25D366]/10 border-r-4 border-r-[#25D366]'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-white mb-1">{campaign.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Users className="w-4 h-4" />
                        <span>{campaign.total_recipients} נמענים</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${statusColors[campaign.status]}`}>
                        {statusLabels[campaign.status]}
                      </span>
                      <button className="text-gray-400 hover:text-white">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {campaign.scheduled_at
                        ? format(new Date(campaign.scheduled_at), 'dd/MM/yyyy', { locale: he })
                        : 'לא מתוזמן'}
                    </span>
                    {campaign.contact_lists && (
                      <span className="text-[#25D366]">
                        {(campaign.contact_lists as { name: string }).name}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Campaign Details */}
        <div className="lg:col-span-7 space-y-4 lg:space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-gray-400 text-sm mb-1">Selected Campaign</p>
              <p className="text-2xl font-bold text-white">{selectedCampaign?.name || '-'}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-gray-400 text-sm mb-1">Total Sending Time</p>
              <p className="text-2xl font-bold text-white">{stats.sendingDuration}</p>
              <p className="text-xs text-gray-500">Sending duration</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-gray-400 text-sm mb-1">Average Response Time</p>
              <p className="text-2xl font-bold text-white">{stats.avgResponseTime}</p>
              <p className="text-xs text-gray-500">Avg. reply time</p>
            </div>
          </div>

          {/* Recipients Table & Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recipients Table */}
            <div className="bg-white/5 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <h3 className="font-medium text-white">Recipients in this Campaign</h3>
              </div>
              <div className="max-h-[250px] sm:max-h-[300px] overflow-y-auto overflow-x-auto">
                <table className="w-full min-w-[300px]">
                  <thead className="bg-white/5">
                    <tr className="text-gray-400 text-xs sm:text-sm">
                      <th className="text-right p-2 sm:p-3">שם</th>
                      <th className="text-right p-2 sm:p-3">סטטוס</th>
                      <th className="text-right p-2 sm:p-3">זמן</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((r, i) => (
                      <tr key={i} className="border-t border-white/5">
                        <td className="p-2 sm:p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-600 rounded-full flex items-center justify-center text-[10px] sm:text-xs text-white flex-shrink-0">
                              {r.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <span className="text-white text-xs sm:text-sm truncate max-w-[80px] sm:max-w-none">{r.name}</span>
                          </div>
                        </td>
                        <td className="p-2 sm:p-3">
                          <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs ${
                            r.status === 'read' ? 'bg-blue-500/20 text-blue-400' :
                            r.status === 'delivered' ? 'bg-green-500/20 text-green-400' :
                            r.status === 'sent' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {r.status === 'read' ? 'נקרא' :
                             r.status === 'delivered' ? 'הגיע' :
                             r.status === 'sent' ? 'נשלח' : 'נכשל'}
                          </span>
                        </td>
                        <td className="p-2 sm:p-3 text-gray-400 text-xs sm:text-sm">{r.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Delivery Overview */}
            <div className="bg-white/5 rounded-xl p-4">
              <h3 className="font-medium text-white mb-4">Message Delivery Overview</h3>
              <div className="flex items-center justify-center">
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50" cy="50" r="40"
                      fill="none"
                      stroke="#1e3a5f"
                      strokeWidth="12"
                    />
                    <circle
                      cx="50" cy="50" r="40"
                      fill="none"
                      stroke="#25D366"
                      strokeWidth="12"
                      strokeDasharray={`${selectedCampaign ? Math.min((selectedCampaign.sent_count / Math.max(selectedCampaign.total_recipients, 1)) * 251, 251) : 0} 251`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-white">
                      {selectedCampaign?.sent_count || 0}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#25D366]" />
                    <span className="text-gray-400">Replies Received</span>
                  </div>
                  <span className="text-white font-medium">{selectedCampaign?.reply_count || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                    <span className="text-gray-400">Messages Sent</span>
                  </div>
                  <span className="text-white font-medium">{selectedCampaign?.sent_count || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Megaphone(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  )
}
