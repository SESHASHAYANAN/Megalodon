import { useRef, useEffect, useState } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'
import { python } from '@codemirror/lang-python'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'

function getLanguage(filename) {
    const ext = filename.split('.').pop().toLowerCase()
    switch (ext) {
        case 'js': case 'jsx': case 'ts': case 'tsx': case 'mjs':
            return javascript({ jsx: true, typescript: ext.includes('ts') })
        case 'html': case 'htm': case 'vue':
            return html()
        case 'css': case 'scss': case 'less':
            return css()
        case 'json':
            return json()
        case 'py':
            return python()
        case 'md': case 'mdx':
            return markdown()
        default:
            return javascript()
    }
}

export default function CodeEditor({ filename, content, onChange }) {
    const editorRef = useRef(null)
    const viewRef = useRef(null)
    const [isEditable, setIsEditable] = useState(false)

    useEffect(() => {
        if (!editorRef.current) return

        // Destroy previous editor
        if (viewRef.current) {
            viewRef.current.destroy()
        }

        const extensions = [
            basicSetup,
            oneDark,
            getLanguage(filename),
            EditorView.lineWrapping,
            EditorState.readOnly.of(!isEditable),
        ]

        if (isEditable && onChange) {
            extensions.push(
                EditorView.updateListener.of(update => {
                    if (update.docChanged) {
                        onChange(update.state.doc.toString())
                    }
                })
            )
        }

        const state = EditorState.create({
            doc: content || '',
            extensions,
        })

        viewRef.current = new EditorView({
            state,
            parent: editorRef.current,
        })

        return () => {
            viewRef.current?.destroy()
        }
    }, [filename, content, isEditable]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="creator-code-editor">
            <div className="creator-code-editor-header">
                <span className="creator-code-editor-filename">{filename}</span>
                <button
                    className={`creator-code-edit-toggle ${isEditable ? 'active' : ''}`}
                    onClick={() => setIsEditable(!isEditable)}
                >
                    {isEditable ? '🔓 Editing' : '🔒 Read-only'}
                </button>
            </div>
            <div className="creator-code-editor-body" ref={editorRef} />
        </div>
    )
}
