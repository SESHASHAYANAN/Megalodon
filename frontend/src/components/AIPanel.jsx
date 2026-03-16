import { useState, useRef, useEffect } from 'react'
import { FiX, FiSend, FiCpu } from 'react-icons/fi'
import { chatWithAI } from '../services/api'

export default function AIPanel({ context, onClose }) {
    const [messages, setMessages] = useState([
        { role: 'assistant', content: "Hi! I'm **ORCA AI**. Ask me anything about code, repos, or how to use ORCA. I'm context-aware — I know what you're currently viewing." }
    ])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const endRef = useRef(null)

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

    const send = async () => {
        if (!input.trim() || loading) return
        const userMsg = { role: 'user', content: input }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setLoading(true)
        try {
            const history = messages.map(m => ({ role: m.role, content: m.content }))
            const data = await chatWithAI(input, context, history)
            setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
        }
        setLoading(false)
    }

    const renderContent = (text) => {
        // Simple markdown rendering
        const parts = text.split(/(\*\*.*?\*\*|`[^`]+`|\n)/g)
        return parts.map((p, i) => {
            if (p.startsWith('**') && p.endsWith('**'))
                return <strong key={i} style={{ color: 'var(--orca-text)' }}>{p.slice(2, -2)}</strong>
            if (p.startsWith('`') && p.endsWith('`'))
                return <code key={i} style={{ background: 'var(--orca-bg)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orca-cyan)' }}>{p.slice(1, -1)}</code>
            if (p === '\n') return <br key={i} />
            return <span key={i}>{p}</span>
        })
    }

    return (
        <div className="animate-slideInRight" style={{
            width: 380, display: 'flex', flexDirection: 'column',
            background: 'var(--orca-bg-secondary)',
            borderLeft: '1px solid var(--orca-border)',
            flexShrink: 0,
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderBottom: '1px solid var(--orca-border)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FiCpu size={16} style={{ color: 'var(--orca-accent)' }} />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>ORCA AI Assistant</span>
                </div>
                <button onClick={onClose} className="btn-ghost" style={{ padding: 4 }}>
                    <FiX size={16} />
                </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.map((msg, i) => (
                    <div key={i} style={{
                        padding: '10px 14px', borderRadius: 10,
                        background: msg.role === 'user' ? 'rgba(88,166,255,0.1)' : 'var(--orca-bg-tertiary)',
                        borderBottomRightRadius: msg.role === 'user' ? 4 : 10,
                        borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 10,
                        alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '90%',
                        fontSize: 13, lineHeight: 1.6,
                    }}>
                        {renderContent(msg.content)}
                    </div>
                ))}
                {loading && (
                    <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--orca-bg-tertiary)', alignSelf: 'flex-start' }}>
                        <div className="spinner" />
                    </div>
                )}
                <div ref={endRef} />
            </div>

            {/* Input */}
            <div style={{ padding: 12, borderTop: '1px solid var(--orca-border)', display: 'flex', gap: 8 }}>
                <input
                    className="input-field"
                    placeholder="Ask ORCA anything..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && send()}
                    style={{ fontSize: 13 }}
                />
                <button onClick={send} className="btn-primary" style={{ padding: '8px 12px', flexShrink: 0 }}>
                    <FiSend size={14} />
                </button>
            </div>
        </div>
    )
}
