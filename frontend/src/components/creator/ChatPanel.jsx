import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import { FiSend, FiZap, FiLoader } from 'react-icons/fi'

export default function ChatPanel({ messages, onSubmit, isGenerating, statusText, hasFiles, stage }) {
    const [input, setInput] = useState('')
    const messagesEndRef = useRef(null)
    const inputRef = useRef(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, statusText])

    const handleSubmit = (e) => {
        e.preventDefault()
        const trimmed = input.trim()
        if (!trimmed || isGenerating) return
        onSubmit(trimmed)
        setInput('')
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit(e)
        }
    }

    return (
        <div className="creator-chat-panel">
            {/* Messages */}
            <div className="creator-chat-messages">
                {messages.length === 0 && (
                    <div className="creator-chat-welcome">
                        <div className="creator-chat-welcome-icon">
                            <FiZap size={28} />
                        </div>
                        <h3>What do you want to build?</h3>
                        <p>Describe your app and I'll generate the complete code with a 3-stage pipeline: Content → Theme → Code.</p>

                        {/* Stage indicator */}
                        <div className="creator-stage-steps">
                            <div className={`creator-stage-step ${stage === 'content' ? 'active' : ''}`}>
                                <span className="creator-stage-num">1</span>
                                <span>Content</span>
                            </div>
                            <div className="creator-stage-arrow">→</div>
                            <div className={`creator-stage-step ${stage === 'style' ? 'active' : ''}`}>
                                <span className="creator-stage-num">2</span>
                                <span>Theme</span>
                            </div>
                            <div className="creator-stage-arrow">→</div>
                            <div className={`creator-stage-step ${stage === 'generating' ? 'active' : ''}`}>
                                <span className="creator-stage-num">3</span>
                                <span>Code</span>
                            </div>
                        </div>

                        <div className="creator-chat-suggestions">
                            {[
                                'A fitness tracking dashboard',
                                'An e-commerce landing page',
                                'A recipe sharing platform',
                                'A portfolio website with dark mode'
                            ].map(s => (
                                <button key={s} className="creator-suggestion-chip" onClick={() => { setInput(s); inputRef.current?.focus() }}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`creator-chat-msg ${msg.role}`}>
                        {msg.role === 'user' ? (
                            <div className="chat-bubble-user">{msg.content}</div>
                        ) : (
                            <div className={`chat-bubble-assistant ${msg.isError ? 'error' : ''}`}>
                                <div className="copilot-response">
                                    <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                                {msg.files && msg.files.length > 0 && (
                                    <div className="creator-chat-files-badge">
                                        📁 {msg.files.length} file{msg.files.length > 1 ? 's' : ''} generated
                                    </div>
                                )}
                                {/* Clarification chips */}
                                {msg.clarificationOptions && msg.clarificationOptions.length > 0 && (
                                    <div className="creator-clarification-chips">
                                        <span className="creator-clarification-label">Which element?</span>
                                        {msg.clarificationOptions.map((opt, j) => (
                                            <button
                                                key={j}
                                                className="creator-clarification-chip"
                                                onClick={() => onSubmit(opt)}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {/* Generating status */}
                {isGenerating && statusText && (
                    <div className="creator-chat-msg assistant">
                        <div className="chat-bubble-assistant generating">
                            <FiLoader className="spin-icon" size={14} />
                            <span>{statusText}</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form className="creator-chat-input-area" onSubmit={handleSubmit}>
                <div className="creator-chat-input-wrapper">
                    <textarea
                        ref={inputRef}
                        className="creator-chat-input"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={hasFiles ? "Describe a change... (e.g., 'make background black')" : "Describe your app idea..."}
                        rows={1}
                        disabled={isGenerating}
                    />
                    <button
                        type="submit"
                        className="creator-chat-send"
                        disabled={!input.trim() || isGenerating}
                    >
                        {isGenerating ? <FiLoader className="spin-icon" size={16} /> : <FiSend size={16} />}
                    </button>
                </div>
                {hasFiles && (
                    <div className="creator-chat-hint">
                        Follow-up prompts apply targeted diffs — your app won't be regenerated from scratch.
                    </div>
                )}
            </form>
        </div>
    )
}
