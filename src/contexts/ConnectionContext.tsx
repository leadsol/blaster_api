'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Connection {
  id: string
  session_name: string
  display_name: string | null
  status: string
}

interface ConnectionContextType {
  connections: Connection[]
  selectedConnection: Connection | null
  setSelectedConnection: (connection: Connection | null) => void
  loadConnections: () => Promise<void>
  isLoading: boolean
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined)

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadConnections = async () => {
    setIsLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setIsLoading(false)
      return
    }

    const { data } = await supabase
      .from('connections')
      .select('id, session_name, display_name, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (data && data.length > 0) {
      setConnections(data)
      // Select the first connected one, or just the first one
      if (!selectedConnection) {
        const connected = data.find(c => c.status === 'connected') || data[0]
        setSelectedConnection(connected)
      }
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadConnections()
  }, [])

  return (
    <ConnectionContext.Provider value={{
      connections,
      selectedConnection,
      setSelectedConnection,
      loadConnections,
      isLoading
    }}>
      {children}
    </ConnectionContext.Provider>
  )
}

export function useConnection() {
  const context = useContext(ConnectionContext)
  if (context === undefined) {
    throw new Error('useConnection must be used within a ConnectionProvider')
  }
  return context
}
