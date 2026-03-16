import { useState } from 'react'
import { FiFolder, FiFile, FiChevronRight, FiChevronDown } from 'react-icons/fi'

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase()
    const icons = {
        html: '🌐', htm: '🌐',
        css: '🎨', scss: '🎨',
        js: '📜', jsx: '⚛️', ts: '📘', tsx: '⚛️',
        json: '📋', md: '📝',
        py: '🐍', vue: '💚',
        txt: '📄',
    }
    return icons[ext] || '📄'
}

function buildTree(files) {
    const tree = {}
    Object.keys(files).forEach(path => {
        const parts = path.split('/')
        let current = tree
        parts.forEach((part, i) => {
            if (i === parts.length - 1) {
                current[part] = { __isFile: true, __path: path }
            } else {
                if (!current[part]) current[part] = {}
                current = current[part]
            }
        })
    })
    return tree
}

function TreeNode({ name, node, depth, selectedFile, onSelect }) {
    const [expanded, setExpanded] = useState(true)

    if (node.__isFile) {
        const isSelected = selectedFile === node.__path
        return (
            <div
                className={`creator-tree-file ${isSelected ? 'selected' : ''}`}
                style={{ paddingLeft: `${12 + depth * 16}px` }}
                onClick={() => onSelect(node.__path)}
            >
                <span className="creator-tree-icon">{getFileIcon(name)}</span>
                <span className="creator-tree-name">{name}</span>
            </div>
        )
    }

    const entries = Object.entries(node).filter(([k]) => !k.startsWith('__'))

    return (
        <div>
            <div
                className="creator-tree-folder"
                style={{ paddingLeft: `${12 + depth * 16}px` }}
                onClick={() => setExpanded(!expanded)}
            >
                {expanded ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}
                <FiFolder size={13} className="creator-tree-folder-icon" />
                <span className="creator-tree-name">{name}</span>
            </div>
            {expanded && entries
                .sort(([, a], [, b]) => (a.__isFile ? 1 : 0) - (b.__isFile ? 1 : 0))
                .map(([childName, childNode]) => (
                    <TreeNode
                        key={childName}
                        name={childName}
                        node={childNode}
                        depth={depth + 1}
                        selectedFile={selectedFile}
                        onSelect={onSelect}
                    />
                ))
            }
        </div>
    )
}

export default function CreatorFileTree({ files, selectedFile, onSelect }) {
    const tree = buildTree(files)
    const entries = Object.entries(tree)
    const fileCount = Object.keys(files).length

    return (
        <div className="creator-file-tree">
            <div className="creator-section-header">
                <span>📁 FILES</span>
                <span className="creator-badge">{fileCount}</span>
            </div>
            <div className="creator-tree-content">
                {entries
                    .sort(([, a], [, b]) => (a.__isFile ? 1 : 0) - (b.__isFile ? 1 : 0))
                    .map(([name, node]) => (
                        <TreeNode
                            key={name}
                            name={name}
                            node={node}
                            depth={0}
                            selectedFile={selectedFile}
                            onSelect={onSelect}
                        />
                    ))
                }
            </div>
        </div>
    )
}
