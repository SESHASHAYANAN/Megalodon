import { useState, useEffect } from 'react'
import { FiCheck, FiX, FiExternalLink } from 'react-icons/fi'

export default function Toast({ message, type = 'success', link, linkText, onClose, duration = 5000 }) {
    const [visible, setVisible] = useState(true)

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false)
            setTimeout(onClose, 300)
        }, duration)
        return () => clearTimeout(timer)
    }, [duration, onClose])

    const bgColor = type === 'success' ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)'
    const borderColor = type === 'success' ? 'var(--orca-green)' : 'var(--orca-red)'
    const iconColor = type === 'success' ? 'var(--orca-green)' : 'var(--orca-red)'

    return (
        <div style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 18px', borderRadius: 10,
            background: bgColor,
            border: `1px solid ${borderColor}`,
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(10px)',
            transition: 'all 0.3s ease',
            maxWidth: 420,
        }}>
            {type === 'success'
                ? <FiCheck size={16} style={{ color: iconColor, flexShrink: 0 }} />
                : <FiX size={16} style={{ color: iconColor, flexShrink: 0 }} />}
            <span style={{ fontSize: 13, color: 'var(--orca-text)', flex: 1 }}>{message}</span>
            {link && (
                <a href={link} target="_blank" rel="noreferrer"
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        color: 'var(--orca-accent)', fontSize: 12, textDecoration: 'none',
                        flexShrink: 0,
                    }}>
                    <FiExternalLink size={12} /> {linkText || 'View'}
                </a>
            )}
            <button onClick={() => { setVisible(false); setTimeout(onClose, 300) }}
                style={{
                    background: 'none', border: 'none', color: 'var(--orca-text-muted)',
                    cursor: 'pointer', padding: 2, flexShrink: 0,
                }}>
                <FiX size={14} />
            </button>
        </div>
    )
}
