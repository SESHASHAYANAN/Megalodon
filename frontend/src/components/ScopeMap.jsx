import { useState, useCallback, useEffect } from 'react'
import { FiChevronRight, FiChevronDown, FiSearch, FiFile, FiBox, FiCode, FiHash, FiZap, FiArrowRight } from 'react-icons/fi'

const NODE_COLORS = {
    class: { bg: 'rgba(56,139,253,0.12)', border: '#388bfd', icon: '#58a6ff', label: '🟦' },
    function: { bg: 'rgba(63,185,80,0.12)', border: '#3fb950', icon: '#3fb950', label: '🟩' },
    async_function: { bg: 'rgba(248,81,73,0.12)', border: '#f85149', icon: '#f85149', label: '🟥' },
    constant: { bg: 'rgba(227,179,65,0.12)', border: '#e3b341', icon: '#e3b341', label: '🟨' },
    file: { bg: 'rgba(139,148,158,0.08)', border: '#30363d', icon: '#8b949e', label: '📄' },
}

function NodeBadge({ type, children, onClick, line }) {
    const color = NODE_COLORS[type] || NODE_COLORS.file
    return (
        <div onClick={onClick} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 10px', borderRadius: 6,
            background: color.bg, border: `1px solid ${color.border}`,
            fontSize: 12, cursor: onClick ? 'pointer' : 'default',
            color: 'var(--orca-text)', transition: 'all 0.15s',
        }}>
            <span style={{ color: color.icon, fontSize: 10 }}>{color.label}</span>
            {children}
            {line && <span style={{ color: 'var(--orca-text-muted)', fontSize: 10, marginLeft: 4 }}>L{line}</span>}
        </div>
    )
}

export default function ScopeMap({ data, onNodeClick }) {
    const [search, setSearch] = useState('')
    const [expanded, setExpanded] = useState({})
    const [explanations, setExplanations] = useState({})

    // Auto-expand first 3 files
    useEffect(() => {
        if (data?.files) {
            const auto = {}
            data.files.slice(0, 3).forEach(f => { auto[f.path] = true })
            setExpanded(auto)
        }
    }, [data])

    const toggle = useCallback((key) => {
        setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
    }, [])

    if (!data || !data.files) return null

    const filteredFiles = data.files.filter(f => {
        if (!search) return true
        const q = search.toLowerCase()
        return f.path.toLowerCase().includes(q)
            || f.classes.some(c => c.name.toLowerCase().includes(q))
            || f.functions.some(fn => fn.name.toLowerCase().includes(q))
            || f.constants.some(c => c.name.toLowerCase().includes(q))
    })

    return (
        <div style={{ marginBottom: 20 }}>
            {/* Stats bar */}
            <div style={{
                display: 'flex', gap: 16, padding: '10px 14px', marginBottom: 12,
                background: 'var(--orca-bg-secondary)', borderRadius: 8,
                border: '1px solid var(--orca-border)', fontSize: 12, flexWrap: 'wrap',
            }}>
                <span style={{ color: 'var(--orca-text-muted)' }}>
                    <FiFile size={11} style={{ marginRight: 4 }} />{data.total_files} files
                </span>
                <span style={{ color: '#58a6ff' }}>
                    <FiBox size={11} style={{ marginRight: 4 }} />{data.total_classes} classes
                </span>
                <span style={{ color: '#3fb950' }}>
                    <FiCode size={11} style={{ marginRight: 4 }} />{data.total_functions} functions
                </span>
                {data.dependencies?.length > 0 && (
                    <span style={{ color: '#e3b341' }}>
                        <FiArrowRight size={11} style={{ marginRight: 4 }} />{data.dependencies.length} dependencies
                    </span>
                )}
            </div>

            {/* Search */}
            <div style={{
                position: 'relative', marginBottom: 12,
            }}>
                <FiSearch size={13} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--orca-text-muted)' }} />
                <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search classes, functions, files..."
                    style={{
                        width: '100%', padding: '7px 10px 7px 30px',
                        background: 'var(--orca-bg-secondary)', border: '1px solid var(--orca-border)',
                        borderRadius: 6, color: 'var(--orca-text)', fontSize: 12, outline: 'none',
                    }}
                />
            </div>

            {/* File tree */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filteredFiles.map(file => {
                    const isOpen = expanded[file.path]
                    const itemCount = file.classes.length + file.functions.length + file.constants.length
                    return (
                        <div key={file.path} style={{
                            background: 'var(--orca-bg-secondary)', border: '1px solid var(--orca-border)',
                            borderRadius: 8, overflow: 'hidden',
                        }}>
                            {/* File header */}
                            <div onClick={() => toggle(file.path)} style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '8px 12px', cursor: 'pointer',
                                borderBottom: isOpen ? '1px solid var(--orca-border)' : 'none',
                            }}>
                                {isOpen ? <FiChevronDown size={13} /> : <FiChevronRight size={13} />}
                                <FiFile size={13} style={{ color: 'var(--orca-accent)', flexShrink: 0 }} />
                                <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{file.path}</span>
                                <span style={{ fontSize: 10, color: 'var(--orca-text-muted)' }}>
                                    {file.lines} lines · {itemCount} items
                                </span>
                                {!file.parseable && (
                                    <span style={{ fontSize: 10, color: 'var(--orca-orange)', background: 'rgba(240,136,62,0.12)', padding: '1px 6px', borderRadius: 4 }}>
                                        binary
                                    </span>
                                )}
                            </div>

                            {/* Expanded content */}
                            {isOpen && (
                                <div style={{ padding: '8px 12px 10px 28px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {/* Classes */}
                                    {file.classes.map((cls, i) => (
                                        <div key={`c-${i}`}>
                                            <NodeBadge type="class" line={cls.line}
                                                onClick={() => onNodeClick?.({ type: 'class', name: cls.name, file: file.path, line: cls.line })}>
                                                <strong>class</strong> {cls.name}
                                            </NodeBadge>
                                            {/* Methods */}
                                            {cls.methods?.length > 0 && (
                                                <div style={{ marginLeft: 20, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                    {cls.methods.map((m, j) => (
                                                        <NodeBadge key={`m-${j}`} type={m.is_async ? 'async_function' : 'function'} line={m.line}
                                                            onClick={() => onNodeClick?.({ type: 'method', name: `${cls.name}.${m.name}`, file: file.path, line: m.line })}>
                                                            {m.is_async && <FiZap size={10} />}
                                                            <span style={{ fontFamily: 'monospace' }}>{m.name}</span>
                                                            <span style={{ color: 'var(--orca-text-muted)', fontSize: 10 }}>
                                                                ({m.params?.join(', ') || ''})
                                                            </span>
                                                            {m.returns && <span style={{ color: '#e3b341', fontSize: 10 }}> → {m.returns}</span>}
                                                        </NodeBadge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {/* Functions */}
                                    {file.functions.map((fn, i) => (
                                        <NodeBadge key={`f-${i}`} type={fn.is_async ? 'async_function' : 'function'} line={fn.line}
                                            onClick={() => onNodeClick?.({ type: 'function', name: fn.name, file: file.path, line: fn.line })}>
                                            {fn.is_async && <FiZap size={10} />}
                                            <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{fn.name}</span>
                                            <span style={{ color: 'var(--orca-text-muted)', fontSize: 10 }}>
                                                ({fn.params?.join(', ') || ''})
                                            </span>
                                            {fn.returns && <span style={{ color: '#e3b341', fontSize: 10 }}> → {fn.returns}</span>}
                                        </NodeBadge>
                                    ))}

                                    {/* Constants */}
                                    {file.constants.map((c, i) => (
                                        <NodeBadge key={`k-${i}`} type="constant" line={c.line}>
                                            <FiHash size={10} />
                                            <span style={{ fontFamily: 'monospace' }}>{c.name}</span>
                                        </NodeBadge>
                                    ))}

                                    {file.classes.length === 0 && file.functions.length === 0 && file.constants.length === 0 && (
                                        <span style={{ fontSize: 11, color: 'var(--orca-text-muted)', fontStyle: 'italic' }}>
                                            No parseable symbols found
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Dependencies */}
            {data.dependencies?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--orca-text-muted)', marginBottom: 6 }}>
                        📎 Dependencies
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {data.dependencies.slice(0, 20).map((dep, i) => (
                            <span key={i} style={{
                                fontSize: 10, padding: '2px 8px', borderRadius: 4,
                                background: 'rgba(227,179,65,0.08)', border: '1px solid rgba(227,179,65,0.2)',
                                color: '#e3b341',
                            }}>
                                {dep.from.split('/').pop()} → {dep.to.split('/').pop()}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
