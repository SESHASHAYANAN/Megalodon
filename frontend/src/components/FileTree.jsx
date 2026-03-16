import { useState } from 'react'
import { FiFolder, FiFile, FiChevronRight, FiChevronDown } from 'react-icons/fi'

function TreeNode({ node, depth = 0, onSelect, selectedPath, modifiedPaths = {} }) {
    const isModified = !!(node.type === 'blob' && modifiedPaths[node.path])
    const [open, setOpen] = useState(depth < 1)
    const isDir = node.type === 'tree'
    const isSelected = selectedPath === node.path

    const getFileIcon = (name) => {
        const ext = name.split('.').pop()
        const colors = {
            js: '#f0db4f', jsx: '#61dafb', ts: '#3178c6', tsx: '#3178c6',
            py: '#3572A5', css: '#563d7c', html: '#e34c26', json: '#6e7681',
            md: '#0076cc', yml: '#cb171e', yaml: '#cb171e',
        }
        return colors[ext] || 'var(--orca-text-muted)'
    }

    return (
        <div>
            <div
                onClick={() => {
                    if (isDir) setOpen(!open)
                    else onSelect(node)
                }}
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 8px', paddingLeft: 8 + depth * 16,
                    cursor: 'pointer', borderRadius: 4,
                    background: isSelected ? 'rgba(88,166,255,0.1)' : 'transparent',
                    color: isSelected ? 'var(--orca-text)' : 'var(--orca-text-secondary)',
                    fontSize: 13, transition: 'all 0.1s ease',
                    userSelect: 'none',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--orca-bg-hover)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
            >
                {isDir ? (
                    open ? <FiChevronDown size={14} style={{ flexShrink: 0 }} /> : <FiChevronRight size={14} style={{ flexShrink: 0 }} />
                ) : (
                    <span style={{ width: 14, flexShrink: 0 }} />
                )}
                {isDir ? (
                    <FiFolder size={14} style={{ color: 'var(--orca-accent)', flexShrink: 0 }} />
                ) : (
                    <FiFile size={14} style={{ color: getFileIcon(node.path), flexShrink: 0 }} />
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {node.path.split('/').pop()}
                </span>
                {isModified && (
                    <span style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: 'var(--orca-orange)', flexShrink: 0,
                        boxShadow: '0 0 4px rgba(240,136,62,0.5)',
                    }} title="Unsaved changes" />
                )}
            </div>
            {isDir && open && node.children && (
                <div>
                    {node.children.map((child, i) => (
                        <TreeNode key={i} node={child} depth={depth + 1} onSelect={onSelect} selectedPath={selectedPath} modifiedPaths={modifiedPaths} />
                    ))}
                </div>
            )}
        </div>
    )
}

export default function FileTree({ tree, onSelect, selectedPath, modifiedPaths = {} }) {
    if (!tree || tree.length === 0) {
        return (
            <div style={{ padding: 20, color: 'var(--orca-text-muted)', fontSize: 13, textAlign: 'center' }}>
                No files to display
            </div>
        )
    }

    return (
        <div style={{ padding: '8px 4px', overflow: 'auto', height: '100%' }}>
            {tree.map((node, i) => (
                <TreeNode key={i} node={node} onSelect={onSelect} selectedPath={selectedPath} modifiedPaths={modifiedPaths} />
            ))}
        </div>
    )
}

// Utility: convert flat GitHub tree to nested structure
export function buildTree(items) {
    const root = []
    const map = {}

    // Sort so directories come first
    const sorted = [...items].sort((a, b) => {
        if (a.type === 'tree' && b.type !== 'tree') return -1
        if (a.type !== 'tree' && b.type === 'tree') return 1
        return a.path.localeCompare(b.path)
    })

    for (const item of sorted) {
        const parts = item.path.split('/')
        const name = parts.pop()
        const parentPath = parts.join('/')

        const node = { ...item, name, children: item.type === 'tree' ? [] : undefined }
        map[item.path] = node

        if (parentPath && map[parentPath]) {
            map[parentPath].children.push(node)
        } else if (!parentPath) {
            root.push(node)
        }
    }

    return root
}
