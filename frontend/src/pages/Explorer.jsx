import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import {
    FiSearch, FiGitBranch, FiStar, FiLoader, FiCpu, FiAlertCircle, FiBox,
    FiHome, FiCode, FiShield, FiSettings, FiEye, FiSend, FiFile, FiFolder,
    FiBookOpen, FiActivity, FiLock, FiX, FiChevronRight, FiUploadCloud,
    FiCopy, FiCheck, FiZap, FiGitMerge, FiGitCommit, FiList, FiGlobe,
    FiInfo, FiRefreshCw, FiMaximize2, FiArrowLeft, FiWifi, FiPlay,
} from 'react-icons/fi'
import FileTree, { buildTree } from '../components/FileTree'
import CodeViewer from '../components/CodeViewer'
import SandboxPanel from '../components/SandboxPanel'
import SandboxPopup from '../components/SandboxPopup'
import LivePreview from '../components/LivePreview'
import ScopeMap from '../components/ScopeMap'
import CommitModal from '../components/CommitModal'
import Toast from '../components/Toast'
import CodingAgentPanel from '../components/CodingAgentPanel'
import AnalysisModal from '../components/AnalysisModal'
import TerminalModal from '../components/TerminalModal'
import { saveSession, loadSession } from '../services/sessionStore'
import CodeReviewPopup from '../components/CodeReviewPopup'
import MappingPanel from '../components/MappingPanel'
import ArchitecturePanel from '../components/ArchitecturePanel'
import OrcaToolbar from '../components/creator/OrcaToolbar'
import PlanningPopup from '../components/creator/PlanningPopup'
import SecurityPopup from '../components/creator/SecurityPopup'
import CompliancePopup from '../components/creator/CompliancePopup'
import DeploymentsPopup from '../components/creator/DeploymentsPopup'
import {
    searchRepos, getRepoTree, getFileContent, explainCode, improveCode,
    createSandbox, getRepoSummary, chatWithAI, getGitHubUser, getUserRepos,
    pushChanges, runAgentStream, runTestCases, runTestCasesStream,
    analyzeIssues, analyzePulls, analyzeWiki, analyzeSecurity, analyzeInsights,
    streamExplainCodebase, streamExplainPurpose,
    getScopeMap,
} from '../services/api'

// ── Markdown code block + copy button ──────────────────────────────────────
function CodeBlock({ children, className }) {
    const [copied, setCopied] = useState(false)
    const lang = className?.replace('language-', '') || ''
    const code = String(children).replace(/\n$/, '')
    const handleCopy = () => {
        navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
    return (
        <div style={{ position: 'relative', marginBottom: 8 }}>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 10px', background: 'var(--orca-bg-elevated)',
                borderRadius: '8px 8px 0 0', border: '1px solid var(--orca-border)', borderBottom: 'none',
            }}>
                <span style={{ fontSize: 10, color: 'var(--orca-text-muted)', fontFamily: 'var(--font-mono)' }}>{lang || 'code'}</span>
                <button onClick={handleCopy} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: copied ? 'var(--orca-green)' : 'var(--orca-text-muted)',
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 6px',
                    borderRadius: 4, transition: 'all 0.15s',
                }}>
                    <FiCopy size={11} /> {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <pre style={{
                margin: 0, padding: 12, overflow: 'auto',
                background: 'var(--orca-bg)', borderRadius: '0 0 8px 8px',
                border: '1px solid var(--orca-border)', borderTop: 'none', fontSize: 12, lineHeight: '18px',
            }}>
                <code className={className}>{children}</code>
            </pre>
        </div>
    )
}

const markdownComponents = {
    code({ node, inline, className, children, ...props }) {
        if (inline) return (
            <code style={{ background: 'var(--orca-bg-tertiary)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orca-cyan)' }} {...props}>
                {children}
            </code>
        )
        return <CodeBlock className={className}>{children}</CodeBlock>
    }
}

// ── 9-Tab definition (matches reference) ─────────────────────────────────
const REPO_TABS = [
    { id: 'code', label: 'Code', emoji: '📁', icon: FiCode },
    { id: 'issues', label: 'Issues', emoji: '⚠️', icon: FiAlertCircle },
    { id: 'pulls', label: 'Pull Requests', emoji: '🔀', icon: FiGitMerge },
    { id: 'actions', label: 'Actions', emoji: '⚡', icon: FiZap },
    { id: 'projects', label: 'Projects', emoji: '📋', icon: FiList },
    { id: 'wiki', label: 'Wiki', emoji: '📖', icon: FiBookOpen },
    { id: 'security', label: 'Security', emoji: '🔒', icon: FiShield },
    { id: 'insights', label: 'Insights', emoji: '📊', icon: FiActivity },
    { id: 'settings', label: 'Settings', emoji: '⚙️', icon: FiSettings },
]

export default function Explorer({ setAIContext }) {
    const [searchParams] = useSearchParams()
    // ── Search + Repo ──
    const [query, setQuery] = useState(searchParams.get('q') || '')
    const [repos, setRepos] = useState([])
    const [selectedRepo, setSelectedRepo] = useState(null)
    const [repoInfo, setRepoInfo] = useState(null)
    const [tree, setTree] = useState([])
    const [rawTree, setRawTree] = useState([])
    const [fileCode, setFileCode] = useState('')
    const [fileName, setFileName] = useState('')
    const [loading, setLoading] = useState(false)
    const [treeLoading, setTreeLoading] = useState(false)
    const [aiResult, setAiResult] = useState('')
    const [aiLoading, setAiLoading] = useState(false)
    const [searchDone, setSearchDone] = useState(false)
    // ── Tabs ──
    const [activeTab, setActiveTab] = useState('code')
    // ── Sandbox ──
    const [sandbox, setSandbox] = useState(null)
    const [sandboxFiles, setSandboxFiles] = useState({})
    const [sandboxLoading, setSandboxLoading] = useState(false)
    // ── Summary ──
    const [summary, setSummary] = useState('')
    const [summaryLoading, setSummaryLoading] = useState(false)
    // ── Copilot ──
    const [copilotMessages, setCopilotMessages] = useState([])
    const [copilotInput, setCopilotInput] = useState('')
    const [copilotLoading, setCopilotLoading] = useState(false)
    const [useCopilot, setUseCopilot] = useState(true)
    const copilotEndRef = useRef(null)
    // ── Preview ──
    const [showPreviewModal, setShowPreviewModal] = useState(false)
    const [hasWebFiles, setHasWebFiles] = useState(false)
    const [previewFiles, setPreviewFiles] = useState({})
    // ── Auth ──
    const [ghUser, setGhUser] = useState(null)
    const [userRepos, setUserRepos] = useState([])
    const [userReposPage, setUserReposPage] = useState(1)
    const [userReposHasNext, setUserReposHasNext] = useState(false)
    const [userReposLoading, setUserReposLoading] = useState(false)
    // ── Edits ──
    const [editedFiles, setEditedFiles] = useState({})
    const [originalFiles, setOriginalFiles] = useState({})
    // ── Push ──
    const [showCommitModal, setShowCommitModal] = useState(false)
    const [pushing, setPushing] = useState(false)
    const [toast, setToast] = useState(null)
    // ── Agent ──
    const [showAgent, setShowAgent] = useState(false)
    // ── Feature agent (per-tab isolated state) ──
    const [tabResults, setTabResults] = useState({})  // { issues: { chunks, loading, label }, pulls: {...}, ... }
    const featureAgentRef = useRef(null)
    // ── Analysis Modals ──
    const [analysisModal, setAnalysisModal] = useState(null) // { title, emoji, content, loading, loadingText, error, filesAnalyzed }
    // ── Test Cases ──
    const [testCasesModal, setTestCasesModal] = useState(null) // { content: string, loading: boolean, lines: [] }
    const [testCasesLoading, setTestCasesLoading] = useState(false)
    const [testAutoDebug, setTestAutoDebug] = useState(null)
    const [testResults, setTestResults] = useState(null)
    const [testMeta, setTestMeta] = useState(null)
    // ── Scope Map ──
    const [scopeMapData, setScopeMapData] = useState(null)
    // ── Code Review Popup ──
    const [codeReviewPopup, setCodeReviewPopup] = useState(null) // { code, filename }
    // ── Mapping & Architecture Modals ──
    const [showMapping, setShowMapping] = useState(false)
    const [showArchitecture, setShowArchitecture] = useState(false)
    // Popup state for ORCA toolbar
    const [showPlanning, setShowPlanning] = useState(false)
    const [showSecurity, setShowSecurity] = useState(false)
    const [showCompliance, setShowCompliance] = useState(false)
    const [showDeployments, setShowDeployments] = useState(false)
    const [showSandboxPopup, setShowSandboxPopup] = useState(false)

    // Helpers to read current tab's feature results
    const currentTabResult = tabResults[activeTab] || { chunks: [], loading: false, label: '' }
    const featureAgentChunks = currentTabResult.chunks || []
    const featureAgentLoading = currentTabResult.loading || false
    const featureAgentLabel = currentTabResult.label || ''
    // ── Copilot width ──
    const [copilotWidth, setCopilotWidth] = useState(340)
    const copilotResizing = useRef(false)

    // ── Session Restore ──
    useEffect(() => {
        loadSession('explorerState').then(saved => {
            if (saved?.selectedRepo) {
                setSelectedRepo(saved.selectedRepo)
                if (saved.rawTree) { setRawTree(saved.rawTree); setTree(buildTree(saved.rawTree)) }
                if (saved.fileName) setFileName(saved.fileName)
                if (saved.fileCode) setFileCode(saved.fileCode)
                if (saved.activeTab) setActiveTab(saved.activeTab)
                if (saved.summary) setSummary(saved.summary)
                const webExts = ['.html', '.css', '.js', '.jsx', '.tsx']
                if (saved.rawTree) setHasWebFiles(saved.rawTree.some(i => webExts.some(ext => i.path?.endsWith(ext))))
            }
        }).catch(() => { })
    }, [])

    // ── Session Save ──
    useEffect(() => {
        if (!selectedRepo) return
        const timer = setTimeout(() => {
            saveSession('explorerState', {
                selectedRepo, rawTree, fileName, fileCode, activeTab, summary
            }).catch(() => { })
        }, 500)
        return () => clearTimeout(timer)
    }, [selectedRepo, rawTree, fileName, fileCode, activeTab, summary])

    useEffect(() => {
        const q = searchParams.get('q')
        if (q) { setQuery(q); doSearch(q) }
    }, [searchParams])

    useEffect(() => { copilotEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [copilotMessages])

    useEffect(() => {
        getGitHubUser().then(data => {
            if (data.authenticated) { setGhUser(data); loadUserRepos(1) }
        }).catch(() => { })
    }, [])

    useEffect(() => {
        if (!selectedRepo) return
        const merged = { ...originalFiles, ...editedFiles }
        if (Object.keys(merged).length > 0) setPreviewFiles(merged)
    }, [editedFiles, originalFiles, selectedRepo])

    const loadUserRepos = async (page) => {
        setUserReposLoading(true)
        try {
            const data = await getUserRepos(page)
            if (page === 1) setUserRepos(data.repos || [])
            else setUserRepos(prev => [...prev, ...(data.repos || [])])
            setUserReposPage(page)
            setUserReposHasNext(data.has_next)
        } catch { }
        setUserReposLoading(false)
    }

    const doSearch = async (q) => {
        if (!q?.trim()) return
        setLoading(true); setSearchDone(false)
        try {
            const parts = q.trim().split('/')
            if (parts.length === 2 && !parts[0].includes(' ')) {
                await loadRepo(parts[0], parts[1])
            } else {
                const data = await searchRepos(q)
                setRepos(data.items || [])
                setSelectedRepo(null); setTree([]); setFileCode(''); setFileName('')
            }
            setSearchDone(true)
        } catch { /* search failed */ }
        setLoading(false)
    }

    const loadRepo = async (owner, repo) => {
        setTreeLoading(true)
        setSelectedRepo({ owner, repo })
        setAIContext?.(`Repository: ${owner}/${repo}`)
        setSummary(''); setEditedFiles({}); setOriginalFiles({})
        setActiveTab('code'); setTabResults({})
        setCopilotMessages([{
            role: 'assistant',
            content: `Welcome to **${owner}/${repo}**!\n\nAsk me anything about this codebase.`
        }])
        try {
            const data = await getRepoTree(owner, repo)
            const items = data.tree || []
            setRawTree(items)
            setTree(buildTree(items))
            setRepos([])
            const webExts = ['.html', '.css', '.js', '.jsx', '.tsx']
            setHasWebFiles(items.some(i => webExts.some(ext => i.path?.endsWith(ext))))
            generateSummary(owner, repo, items)
        } catch { /* tree load failed */ }
        setTreeLoading(false)
    }

    const generateSummary = async (owner, repo, items) => {
        setSummaryLoading(true)
        try {
            const fileList = items.filter(i => i.type === 'blob').map(i => i.path).slice(0, 80).join('\n')
            const data = await getRepoSummary(`Analyze repository ${owner}/${repo}.\n\nFile tree:\n${fileList}`, `Repository: ${owner}/${repo}`)
            setSummary(data.summary || '')
        } catch { setSummary('Could not generate summary.') }
        setSummaryLoading(false)
    }

    const loadFile = async (node) => {
        if (node.type === 'tree') return
        setLoading(true); setAiResult(''); setActiveTab('code')
        try {
            let content = ''
            if (editedFiles[node.path] !== undefined) {
                content = editedFiles[node.path]
            } else {
                const data = await getFileContent(selectedRepo.owner, selectedRepo.repo, node.path)
                content = data.decoded_content || data.content
                setOriginalFiles(prev => ({ ...prev, [node.path]: content }))
            }
            setFileCode(content); setFileName(node.path)
            setAIContext?.(`Repository: ${selectedRepo.owner}/${selectedRepo.repo}, File: ${node.path}`)
            if (hasWebFiles) {
                const merged = { ...originalFiles, ...editedFiles, [node.path]: content }
                setPreviewFiles(merged)
            }
        } catch { setFileCode('// Error loading file'); setFileName(node.path) }
        setLoading(false)
    }

    const handleCodeEdit = useCallback((newCode) => {
        if (!fileName) return
        const original = originalFiles[fileName]
        if (original !== undefined && newCode !== original) setEditedFiles(prev => ({ ...prev, [fileName]: newCode }))
        else setEditedFiles(prev => { const n = { ...prev }; delete n[fileName]; return n })
        setFileCode(newCode)
    }, [fileName, originalFiles])

    const modifiedFileCount = Object.keys(editedFiles).length

    const handlePush = async (commitMessage) => {
        if (!selectedRepo || modifiedFileCount === 0) return
        setPushing(true)
        try {
            const result = await pushChanges(selectedRepo.owner, selectedRepo.repo, editedFiles, commitMessage)
            setShowCommitModal(false); setEditedFiles({})
            setToast({ message: `Pushed ${result.files_pushed} files!`, type: 'success', link: result.commit_url, linkText: `View commit ${result.commit_sha?.slice(0, 7)}` })
        } catch (e) { setToast({ message: e.message || 'Push failed', type: 'error' }) }
        setPushing(false)
    }

    const handleExplain = async (code, filename) => {
        setAiLoading(true); setAiResult('')
        try {
            const data = await explainCode(code, filename, `Repo: ${selectedRepo?.owner}/${selectedRepo?.repo}`)
            setAiResult(data.explanation)
        } catch { setAiResult('Error getting explanation.') }
        setAiLoading(false)
    }

    const handleImprove = async (code, filename, type) => {
        setAiLoading(true); setAiResult('')
        try {
            const instruction = type === 'find-issues' ? 'Find bugs and issues' : 'Suggest improvements'
            const data = await improveCode(code, filename, instruction)
            setAiResult(data.improvements)
        } catch { setAiResult('Error getting suggestions.') }
        setAiLoading(false)
    }

    const handleCopilotSend = async () => {
        if (!copilotInput.trim() || copilotLoading) return
        const msg = copilotInput
        setCopilotMessages(prev => [...prev, { role: 'user', content: msg }])
        setCopilotInput(''); setCopilotLoading(true)
        try {
            const ctx = `Repository: ${selectedRepo?.owner}/${selectedRepo?.repo}${fileName ? `, File: ${fileName}` : ''}`
            const data = await chatWithAI(msg, ctx, copilotMessages.slice(-6))
            setCopilotMessages(prev => [...prev, { role: 'assistant', content: data.response }])
        } catch {
            setCopilotMessages(prev => [...prev, { role: 'assistant', content: 'Error getting response.' }])
        }
        setCopilotLoading(false)
    }

    const getSourceFilePaths = useCallback(() => {
        const sourceExts = ['.js', '.jsx', '.ts', '.tsx', '.py', '.css', '.html', '.vue', '.go', '.rs', '.java', '.rb', '.php', '.json', '.yml', '.yaml', '.md']
        return rawTree
            .filter(i => i.type === 'blob' && sourceExts.some(ext => i.path.endsWith(ext)))
            .slice(0, 15)
            .map(i => i.path)
    }, [rawTree])

    const runFeatureAnalysis = useCallback(async (tabId) => {
        if (!selectedRepo) return
        const labels = { security: 'Security Audit', insights: 'Insights', issues: 'Issues Analysis', pulls: 'Pull Request Suggestions', actions: 'Actions & CI/CD', projects: 'Project Overview', wiki: 'Documentation', settings: 'Settings Analysis' }
        // Update per-tab state — set loading for THIS tab only
        setTabResults(prev => ({
            ...prev,
            [tabId]: { chunks: [], loading: true, label: labels[tabId] || tabId }
        }))
        const filePaths = getSourceFilePaths()
        try {
            let data
            switch (tabId) {
                case 'issues':
                    data = await analyzeIssues(selectedRepo.owner, selectedRepo.repo, filePaths)
                    break
                case 'pulls':
                    data = await analyzePulls(selectedRepo.owner, selectedRepo.repo, filePaths)
                    break
                case 'wiki':
                    data = await analyzeWiki(selectedRepo.owner, selectedRepo.repo, filePaths)
                    break
                case 'security':
                    data = await analyzeSecurity(selectedRepo.owner, selectedRepo.repo, filePaths)
                    break
                case 'insights':
                    data = await analyzeInsights(selectedRepo.owner, selectedRepo.repo, filePaths)
                    break
                default: {
                    const ctx = `Repository: ${selectedRepo.owner}/${selectedRepo.repo}\nFile list (top 60):\n${rawTree.filter(i => i.type === 'blob').slice(0, 60).map(i => i.path).join('\n')}`
                    const prompts = {
                        actions: `Recommend CI/CD workflow improvements for ${selectedRepo.owner}/${selectedRepo.repo}.`,
                        projects: `Summarize the project structure and roadmap for ${selectedRepo.owner}/${selectedRepo.repo}.`,
                        settings: `Analyze the configuration and settings files in ${selectedRepo.owner}/${selectedRepo.repo}.`,
                    }
                    const chatData = await chatWithAI(prompts[tabId] || `Analyze ${tabId}`, ctx, [])
                    data = { analysis: chatData.response }
                    break
                }
            }
            const filesAnalyzed = data.files_analyzed ? data.files_analyzed.length : filePaths.length
            // Store results in per-tab bucket
            setTabResults(prev => ({
                ...prev,
                [tabId]: {
                    chunks: [
                        { type: 'repo_scan', content: `📂 Analyzed ${filesAnalyzed} source files from ${selectedRepo.owner}/${selectedRepo.repo}` },
                        { type: 'code', content: data.analysis || 'No analysis returned.' },
                        ...(data.existing_prs && data.existing_prs.length > 0 ? [{ type: 'code', content: '\n\n## Open Pull Requests\n' + data.existing_prs.map(pr => `- [#${pr.number}](${pr.url}) **${pr.title}** by @${pr.user}`).join('\n') }] : []),
                        { type: 'done' },
                    ],
                    loading: false,
                    label: labels[tabId] || tabId,
                }
            }))
        } catch (e) {
            setTabResults(prev => ({
                ...prev,
                [tabId]: {
                    chunks: [{ type: 'error', content: e.message || 'Analysis failed.' }],
                    loading: false,
                    label: labels[tabId] || tabId,
                }
            }))
        }
    }, [selectedRepo, rawTree, getSourceFilePaths])

    const handleTabClick = (tabId) => {
        setActiveTab(tabId)
        // Each tab has its own independent results — only auto-run if empty
        const existing = tabResults[tabId]
        if (['security', 'insights', 'issues', 'pulls', 'actions', 'projects', 'wiki', 'settings'].includes(tabId)) {
            if (!existing || (existing.chunks.length === 0 && !existing.loading)) {
                runFeatureAnalysis(tabId)
            }
        }
    }

    // ── Modal handlers ──
    const handleExplainPurpose = async () => {
        if (!selectedRepo || !fileCode) return
        setAnalysisModal({ title: 'File Purpose & Explanation', emoji: '📖', content: '', loading: true, loadingText: `Analyzing ${fileName}...`, error: null, filesAnalyzed: [] })
        try {
            const ctx = `Repository: ${selectedRepo.owner}/${selectedRepo.repo}`
            const resp = await streamExplainPurpose(fileCode, fileName, ctx)
            if (!resp.ok) throw new Error('Explain purpose request failed')
            const reader = resp.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let sections = []
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop()
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    try {
                        const data = JSON.parse(line.slice(6))
                        if (data.type === 'section') {
                            sections.push(data)
                            const md = sections.map(s => `## ${s.emoji} ${s.title}\n\n${s.content}`).join('\n\n---\n\n')
                            setAnalysisModal(prev => ({ ...prev, content: md }))
                        } else if (data.type === 'error') {
                            setAnalysisModal(prev => ({ ...prev, error: data.message }))
                        } else if (data.type === 'done') {
                            setAnalysisModal(prev => ({ ...prev, loading: false }))
                        }
                    } catch { }
                }
            }
            setAnalysisModal(prev => ({ ...prev, loading: false }))
        } catch (e) {
            setAnalysisModal(prev => ({ ...prev, loading: false, error: e.message || 'Analysis failed.' }))
        }
    }

    const handleExplainCodebase = async () => {
        if (!selectedRepo) return
        setAnalysisModal({ title: 'Codebase Explanation', emoji: '📊', content: '', loading: true, loadingText: 'Reading all files and building dependency map...', error: null, filesAnalyzed: [], scopeMap: null })
        try {
            const filePaths = getSourceFilePaths()

            // Fetch scope map data in parallel
            try {
                const smData = await getScopeMap(selectedRepo.owner, selectedRepo.repo, filePaths)
                setScopeMapData(smData)
                setAnalysisModal(prev => ({ ...prev, scopeMap: smData }))
            } catch { }

            const resp = await streamExplainCodebase(selectedRepo.owner, selectedRepo.repo, filePaths)
            if (!resp.ok) throw new Error('Explain codebase request failed')
            const reader = resp.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let sections = []
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop()
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    try {
                        const data = JSON.parse(line.slice(6))
                        if (data.type === 'section') {
                            sections.push(data)
                            const md = sections.map(s => `## ${s.emoji} ${s.title}\n\n${s.content}`).join('\n\n---\n\n')
                            setAnalysisModal(prev => ({ ...prev, content: md }))
                        } else if (data.type === 'files_analyzed') {
                            setAnalysisModal(prev => ({ ...prev, filesAnalyzed: data.files || [] }))
                        } else if (data.type === 'error') {
                            setAnalysisModal(prev => ({ ...prev, error: data.message }))
                        } else if (data.type === 'done') {
                            setAnalysisModal(prev => ({ ...prev, loading: false }))
                        }
                    } catch { }
                }
            }
            setAnalysisModal(prev => ({ ...prev, loading: false }))
        } catch (e) {
            setAnalysisModal(prev => ({ ...prev, loading: false, error: e.message || 'Analysis failed.' }))
        }
    }

    const handleRunTestCases = async () => {
        if (!selectedRepo) return
        setTestCasesLoading(true)
        setTestAutoDebug(null)
        setTestResults(null)
        setTestMeta(null)
        setTestCasesModal({ content: '', loading: true, error: null, lines: [] })
        try {
            const filePaths = getSourceFilePaths()
            const resp = await runTestCasesStream(selectedRepo.owner, selectedRepo.repo, filePaths)
            if (!resp.ok) throw new Error('Test stream failed')
            const reader = resp.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                const sseLines = buffer.split('\n')
                buffer = sseLines.pop()
                for (const sseLine of sseLines) {
                    if (!sseLine.startsWith('data: ')) continue
                    try {
                        const data = JSON.parse(sseLine.slice(6))
                        if (data.type === 'output') {
                            setTestCasesModal(prev => ({
                                ...prev,
                                lines: [...(prev?.lines || []), data.line]
                            }))
                        } else if (data.type === 'status') {
                            setTestCasesModal(prev => ({
                                ...prev,
                                lines: [...(prev?.lines || []), `\x1b[36m${data.message}\x1b[0m`]
                            }))
                        } else if (data.type === 'auto_debug_start') {
                            setTestAutoDebug(data.message)
                        } else if (data.type === 'auto_debug_fix') {
                            setTestAutoDebug('Re-running with AI fix...')
                        } else if (data.type === 'auto_debug_error') {
                            setTestAutoDebug(null)
                        } else if (data.type === 'error') {
                            setTestCasesModal(prev => ({ ...prev, error: data.message }))
                        } else if (data.type === 'result') {
                            setTestAutoDebug(null)
                            if (data.test_results) setTestResults(data.test_results)
                        } else if (data.type === 'done') {
                            setTestCasesModal(prev => ({ ...prev, loading: false }))
                            if (data.test_results) setTestResults(data.test_results)
                            if (data.owner || data.repo || data.test_code) {
                                setTestMeta({ owner: data.owner, repo: data.repo, test_code: data.test_code || '', full_output: data.full_output || '' })
                            }
                        }
                    } catch { }
                }
            }
        } catch (e) {
            setTestCasesModal(prev => ({ ...prev, loading: false, error: e.message || 'Test stream failed.' }))
        }
        setTestCasesLoading(false)
        setTestAutoDebug(null)
    }

    const handleCodeReview = (code, filename) => {
        setCodeReviewPopup({ code, filename })
    }

    const handleCreateSandbox = async () => {
        if (!selectedRepo) return
        setSandboxLoading(true)
        try {
            const blobs = rawTree.filter(i => i.type === 'blob').slice(0, 50)
            const fileContents = {}
            for (const blob of blobs) {
                try {
                    const data = await getFileContent(selectedRepo.owner, selectedRepo.repo, blob.path)
                    fileContents[blob.path] = data.decoded_content || data.content
                } catch { }
            }
            setSandboxFiles(fileContents)
            const data = await createSandbox(selectedRepo.owner, selectedRepo.repo, fileContents)
            setSandbox(data)
        } catch { /* sandbox creation failed */ }
        setSandboxLoading(false)
    }

    // Resize Copilot panel
    const handleResizeMouseDown = useCallback((e) => {
        e.preventDefault()
        copilotResizing.current = true
        const startX = e.clientX, startWidth = copilotWidth
        const onMouseMove = (e) => {
            if (!copilotResizing.current) return
            const delta = startX - e.clientX
            setCopilotWidth(Math.max(280, Math.min(600, startWidth + delta)))
        }
        const onMouseUp = () => {
            copilotResizing.current = false
            document.removeEventListener('mousemove', onMouseMove)
            document.removeEventListener('mouseup', onMouseUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', onMouseUp)
    }, [copilotWidth])

    // ── Sandbox overlay ───────────────────────────────────────────────────────
    if (sandbox) {
        return <SandboxPanel sandboxId={sandbox.id} owner={sandbox.owner} repo={sandbox.repo}
            initialFiles={sandboxFiles} onClose={() => setSandbox(null)} />
    }

    // ── Search / Home view ────────────────────────────────────────────────────
    if (!selectedRepo) {
        return (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--orca-bg)' }}>
                {/* Search bar */}
                <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--orca-border)', background: 'var(--orca-bg-secondary)' }}>
                    <form onSubmit={e => { e.preventDefault(); doSearch(query) }} style={{ display: 'flex', gap: 10, maxWidth: 700 }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <FiSearch size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--orca-text-muted)' }} />
                            <input className="input-field" placeholder="Search repos or enter owner/repo..."
                                value={query} onChange={e => setQuery(e.target.value)} style={{ paddingLeft: 38 }} />
                        </div>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? <FiLoader size={14} className="spinner" /> : <><FiSearch size={14} /> Search</>}
                        </button>
                    </form>
                </div>

                <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
                    {/* Authenticated user's repos */}
                    {ghUser && userRepos.length > 0 && !repos.length && !searchDone && (
                        <div style={{ marginBottom: 32 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                <img src={ghUser.avatar_url} alt="" style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--orca-accent)' }} />
                                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--orca-text)' }}>Your Repositories</h3>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                                {userRepos.map(repo => (
                                    <div key={repo.id} className="glass-card"
                                        onClick={() => loadRepo(repo.owner.login, repo.name)}
                                        style={{ padding: 0, cursor: 'pointer', overflow: 'hidden' }}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                                        <div style={{ height: 3, background: repo.private ? 'linear-gradient(90deg,#f0883e,#e0a040)' : 'var(--orca-gradient)' }} />
                                        <div style={{ padding: '14px 16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                <FiGitBranch size={13} style={{ color: 'var(--orca-accent)' }} />
                                                <span style={{ fontWeight: 700, color: 'var(--orca-accent)', fontSize: 13 }}>{repo.name}</span>
                                                {repo.private && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'rgba(240,136,62,0.12)', color: 'var(--orca-orange)' }}><FiLock size={9} /> private</span>}
                                                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--orca-text-muted)' }}><FiStar size={11} /> {repo.stargazers_count}</span>
                                            </div>
                                            <p style={{ fontSize: 12, color: 'var(--orca-text-secondary)', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                {repo.description || 'No description'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {userReposHasNext && (
                                <button className="btn-secondary" onClick={() => loadUserRepos(userReposPage + 1)} disabled={userReposLoading} style={{ marginTop: 14, padding: '8px 20px', fontSize: 12 }}>
                                    {userReposLoading ? <FiLoader size={13} className="spinner" /> : 'Load More'}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Search results */}
                    {repos.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, maxWidth: 1100 }}>
                            {repos.map(repo => (
                                <div key={repo.id} className="glass-card"
                                    onClick={() => loadRepo(repo.owner.login, repo.name)}
                                    style={{ padding: 0, cursor: 'pointer', overflow: 'hidden' }}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                                    <div style={{ height: 4, background: 'var(--orca-gradient)' }} />
                                    <div style={{ padding: '16px 18px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                            <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(124,106,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <FiGitBranch size={14} style={{ color: 'var(--orca-accent)' }} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, color: 'var(--orca-accent)', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{repo.full_name}</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--orca-text-muted)', fontSize: 12, flexShrink: 0 }}>
                                                <FiStar size={11} /> {repo.stargazers_count > 999 ? (repo.stargazers_count / 1000).toFixed(1) + 'k' : repo.stargazers_count}
                                            </div>
                                        </div>
                                        <p style={{ fontSize: 12, color: 'var(--orca-text-secondary)', lineHeight: 1.6, margin: '0 0 10px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {repo.description || 'No description provided'}
                                        </p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {repo.language && <span className="badge" style={{ fontSize: 11 }}>{repo.language}</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : searchDone ? (
                        <div style={{ textAlign: 'center', padding: 60, color: 'var(--orca-text-muted)' }}>
                            <FiAlertCircle size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                            <p>No repositories found.</p>
                        </div>
                    ) : !ghUser && (
                        <div style={{ textAlign: 'center', padding: 80, color: 'var(--orca-text-muted)' }}>
                            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--orca-text)', marginBottom: 8 }}>Search GitHub Repositories</p>
                            <p style={{ fontSize: 13 }}>Try "facebook/react" or "machine learning"</p>
                        </div>
                    )}
                </div>
                {toast && <Toast {...toast} onClose={() => setToast(null)} />}
            </div>
        )
    }

    // ── Repo View ─────────────────────────────────────────────────────────────
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--orca-bg)' }}>

            {/* ── Header bar (matches reference) ── */}
            <div className="repo-header">
                {/* Left: Back button */}
                <button className="btn-secondary"
                    onClick={() => { setSelectedRepo(null); setTree([]); setFileCode(''); setSummary(''); setEditedFiles({}); setOriginalFiles({}) }}
                    style={{ padding: '6px 14px', fontSize: 13, gap: 6, flexShrink: 0 }}>
                    <FiArrowLeft size={14} /> Back
                </button>

                {/* Center: Repo name */}
                <div className="repo-header-title">
                    {selectedRepo.repo}
                    {modifiedFileCount > 0 && (
                        <span style={{ marginLeft: 10, fontSize: 11, padding: '2px 9px', borderRadius: 10, background: 'rgba(240,136,62,0.15)', color: 'var(--orca-orange)', fontWeight: 600 }}>
                            {modifiedFileCount} unsaved
                        </span>
                    )}
                </div>

                {/* Right: Action buttons */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    <button className="btn-header-action" onClick={() => setShowMapping(true)}>
                        <FiZap size={13} /> Mapping
                    </button>
                    <button className="btn-header-action" onClick={() => setShowArchitecture(true)}>
                        <FiBox size={13} /> Imagine Architecture
                    </button>
                    <button className="btn-header-action" onClick={handleExplainCodebase}>
                        <FiBookOpen size={13} /> Explain Codebase
                    </button>
                    <button className="btn-header-action" onClick={handleExplainPurpose}>
                        <FiInfo size={13} /> Explain Purpose
                    </button>
                    {fileName && (
                        <button className="btn-header-action" onClick={() => setShowSandboxPopup(true)} style={{ background: 'rgba(124,106,255,0.1)', borderColor: 'rgba(124,106,255,0.3)', color: 'var(--orca-accent,#7c6aff)' }}>
                            <FiPlay size={13} /> Sandbox
                        </button>
                    )}
                    <button className="btn-header-action" onClick={() => setShowAgent(true)} style={{ background: 'rgba(63,185,80,0.1)', borderColor: 'rgba(63,185,80,0.3)', color: '#3fb950' }}>
                        <FiZap size={13} /> Generate
                    </button>
                    <button className="btn-ghost" onClick={() => setShowAgent(true)} style={{ padding: '6px 8px' }} title="AI Agent">
                        <FiCpu size={15} />
                    </button>
                    {ghUser && modifiedFileCount > 0 && (
                        <button className="btn-primary" onClick={() => setShowCommitModal(true)} style={{ padding: '6px 14px', fontSize: 12 }}>
                            <FiUploadCloud size={13} /> Push
                        </button>
                    )}
                    <button className="btn-ghost" style={{ padding: '6px 8px' }} title="Settings">
                        <FiSettings size={15} />
                    </button>
                </div>
            </div>

            {/* ORCA Pill Toolbar */}
            <OrcaToolbar
                onPlanningClick={() => setShowPlanning(true)}
                onSecurityClick={() => setShowSecurity(true)}
                onComplianceClick={() => setShowCompliance(true)}
                onDeploymentsClick={() => setShowDeployments(true)}
            />

            {/* ── 9-Tab strip ── */}
            <div className="repo-tab-bar">
                {REPO_TABS.map(tab => (
                    <button key={tab.id}
                        className={`repo-tab${activeTab === tab.id ? ' active' : ''}`}
                        onClick={() => handleTabClick(tab.id)}>
                        <span>{tab.emoji}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── 3-column body ── */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* ── Left: File Tree ── */}
                <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--orca-bg-secondary)', borderRight: '1px solid var(--orca-border)' }}>
                    <div className="file-tree-header">Files</div>
                    {/* Root breadcrumb */}
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--orca-border)' }}>
                        <span className="root-breadcrumb">🏠 Root</span>
                    </div>
                    <div style={{ flex: 1, overflow: 'auto' }}>
                        {treeLoading ? (
                            <div style={{ padding: 20, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                        ) : (
                            <FileTree tree={tree} onSelect={loadFile} selectedPath={fileName} modifiedPaths={editedFiles} />
                        )}
                    </div>
                </div>

                {/* ── Center: Content area ── */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--orca-bg)' }}>

                    {/* Non-code tabs: Security / Insights / etc. */}
                    {activeTab !== 'code' ? (
                        <div ref={featureAgentRef} style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
                            {/* Agent header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--orca-border)' }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: 10,
                                    background: activeTab === 'security' ? 'rgba(240,136,62,0.15)' : 'rgba(124,106,255,0.15)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <span style={{ fontSize: 18 }}>
                                        {REPO_TABS.find(t => t.id === activeTab)?.emoji || '📊'}
                                    </span>
                                </div>
                                <div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--orca-text)' }}>
                                        {featureAgentLabel || REPO_TABS.find(t => t.id === activeTab)?.label}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--orca-text-muted)' }}>Powered by ORCA AI · {selectedRepo.owner}/{selectedRepo.repo}</div>
                                </div>
                                {featureAgentLoading && (
                                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--orca-accent)' }}>
                                        <div className="spinner" style={{ width: 14, height: 14 }} /> Analyzing...
                                    </div>
                                )}
                            </div>

                            {/* Status pills */}
                            {featureAgentChunks.filter(c => c.type === 'repo_scan').map((c, i) => (
                                <div key={i} className="status-pill scan" style={{ marginBottom: 8, display: 'flex' }}><FiCpu size={11} /> {c.content}</div>
                            ))}

                            {/* Main analysis output */}
                            {featureAgentChunks.filter(c => c.type === 'code').map((c, i) => (
                                <div key={i} className="markdown-content copilot-response" style={{ fontSize: 14, marginTop: 8 }}>
                                    <ReactMarkdown rehypePlugins={[rehypeHighlight]} components={markdownComponents}>{c.content}</ReactMarkdown>
                                </div>
                            ))}

                            {/* Done */}
                            {featureAgentChunks.filter(c => c.type === 'done').map((_, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginTop: 14, borderRadius: 8, background: 'rgba(63,185,80,0.1)', color: '#3fb950', fontSize: 12 }}>
                                    <FiCheck size={14} /> Analysis complete.
                                </div>
                            ))}

                            {/* Error */}
                            {featureAgentChunks.filter(c => c.type === 'error').map((c, i) => (
                                <div key={i} style={{ padding: '10px 14px', marginTop: 8, borderRadius: 8, background: 'rgba(248,81,73,0.1)', color: 'var(--orca-red)', fontSize: 12 }}>
                                    <FiAlertCircle size={14} style={{ marginRight: 6 }} />{c.content}
                                </div>
                            ))}

                            {featureAgentChunks.length === 0 && !featureAgentLoading && (
                                <div style={{ textAlign: 'center', padding: 60, color: 'var(--orca-text-muted)' }}>
                                    <div style={{ fontSize: 40, marginBottom: 14 }}>{REPO_TABS.find(t => t.id === activeTab)?.emoji}</div>
                                    <p style={{ fontSize: 14 }}>Click the tab to run the {REPO_TABS.find(t => t.id === activeTab)?.label} analysis.</p>
                                </div>
                            )}
                        </div>

                    ) : !fileName ? (
                        /* Code tab, no file selected → repo overview */
                        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
                            <div className="glass-card" style={{ padding: 22, marginBottom: 18 }}>
                                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
                                    📦 {selectedRepo.repo}
                                </h3>
                                <p style={{ fontSize: 13, color: 'var(--orca-text-muted)', marginBottom: 16 }}>{selectedRepo.owner}/{selectedRepo.repo}</p>
                                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--orca-text-secondary)' }}>Root files:</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {rawTree.filter(i => !i.path.includes('/')).slice(0, 20).map((item, i) => (
                                        <div key={i}
                                            onClick={() => item.type === 'blob' && loadFile(item)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 9, padding: '7px 11px',
                                                borderRadius: 6, cursor: item.type === 'blob' ? 'pointer' : 'default',
                                                background: 'var(--orca-bg-elevated)', fontSize: 13,
                                                transition: 'background 0.1s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--orca-bg-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'var(--orca-bg-elevated)'}>
                                            {item.type === 'tree'
                                                ? <FiFolder size={14} style={{ color: 'var(--orca-yellow)' }} />
                                                : <FiFile size={14} style={{ color: 'var(--orca-text-muted)' }} />}
                                            <span>{item.path}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {(summaryLoading || summary) && (
                                <div className="glass-card" style={{ padding: 20 }}>
                                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <FiCpu size={14} style={{ color: 'var(--orca-accent)' }} /> AI Analysis
                                    </h4>
                                    {summaryLoading ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--orca-text-muted)', fontSize: 13 }}>
                                            <div className="spinner" /> Generating analysis...
                                        </div>
                                    ) : (
                                        <div className="markdown-content copilot-response" style={{ fontSize: 13 }}>
                                            <ReactMarkdown rehypePlugins={[rehypeHighlight]} components={markdownComponents}>{summary}</ReactMarkdown>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                    ) : (
                        /* Code tab, file selected */
                        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                {/* Run in Sandbox button */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '6px 14px', borderBottom: '1px solid var(--orca-border)',
                                    background: 'var(--orca-bg-elevated)', flexShrink: 0,
                                }}>
                                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--orca-text-muted)' }}>
                                        {fileName}
                                    </span>
                                    <button
                                        onClick={() => setShowSandboxPopup(true)}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 5,
                                            padding: '4px 12px', background: 'rgba(124,106,255,0.15)',
                                            border: '1px solid var(--orca-accent)', borderRadius: 6,
                                            color: 'var(--orca-accent)', fontSize: 11, fontWeight: 600,
                                            cursor: 'pointer', transition: 'all 0.15s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,106,255,0.25)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(124,106,255,0.15)'}
                                    >
                                        <FiPlay size={11} /> Run in Sandbox
                                    </button>
                                </div>
                                <CodeViewer code={fileCode} filename={fileName}
                                    onExplain={handleExplain} onImprove={handleImprove}
                                    onCodeReview={handleCodeReview}
                                    loading={aiLoading} isModified={!!editedFiles[fileName]} />
                            </div>
                        </div>
                    )}

                    {/* AI result bar (bottom of center) */}
                    {fileName && (aiResult || aiLoading) && activeTab === 'code' && (
                        <div style={{ maxHeight: 240, overflow: 'auto', padding: '14px 18px', borderTop: '1px solid var(--orca-border)', background: 'var(--orca-bg-secondary)', fontSize: 13 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                                <FiCpu size={13} style={{ color: 'var(--orca-accent)' }} />
                                <span style={{ fontWeight: 600, fontSize: 12 }}>AI Analysis</span>
                                <button className="btn-ghost" onClick={() => setAiResult('')} style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 6px' }}>✕</button>
                            </div>
                            {aiLoading ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--orca-text-muted)' }}><div className="spinner" /> Analyzing...</div>
                            ) : (
                                <div className="markdown-content copilot-response">
                                    <ReactMarkdown rehypePlugins={[rehypeHighlight]} components={markdownComponents}>{aiResult}</ReactMarkdown>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Right: GitHub Copilot panel ── */}
                <div className="copilot-panel" style={{ width: copilotWidth, flexShrink: 0, position: 'relative' }}>
                    {/* Resize handle */}
                    <div
                        onMouseDown={handleResizeMouseDown}
                        style={{ position: 'absolute', left: -3, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 10, background: 'transparent' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,106,255,0.3)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    />

                    {/* Copilot header */}
                    <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--orca-border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--orca-bg-elevated)', flexShrink: 0 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--orca-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 13 }}>🤖</span>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--orca-text)' }}>GitHub Copilot</span>
                        <button className="btn-ghost" style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 9px', color: 'var(--orca-text-muted)', border: '1px solid var(--orca-border)', borderRadius: 6 }}>
                            Minimize
                        </button>
                    </div>

                    {/* ── Compact Action Toolbar (Fix 3) ── */}
                    <div style={{
                        display: 'flex', gap: 4, padding: '8px 14px', flexWrap: 'wrap',
                        borderBottom: '1px solid var(--orca-border)',
                        background: 'var(--orca-bg-secondary)', flexShrink: 0,
                    }}>
                        <button className="copilot-toolbar-btn" onClick={handleExplainPurpose}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 11, fontWeight: 600, background: 'var(--orca-bg-elevated)', border: '1px solid var(--orca-border)', borderRadius: 6, cursor: 'pointer', color: 'var(--orca-purple)', transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--orca-purple)'; e.currentTarget.style.background = 'rgba(157,125,255,0.1)' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--orca-border)'; e.currentTarget.style.background = 'var(--orca-bg-elevated)' }}>
                            <FiBookOpen size={11} /> Purpose
                        </button>
                        <button className="copilot-toolbar-btn" onClick={handleExplainCodebase}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 11, fontWeight: 600, background: 'var(--orca-bg-elevated)', border: '1px solid var(--orca-border)', borderRadius: 6, cursor: 'pointer', color: 'var(--orca-cyan)', transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--orca-cyan)'; e.currentTarget.style.background = 'rgba(57,210,192,0.1)' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--orca-border)'; e.currentTarget.style.background = 'var(--orca-bg-elevated)' }}>
                            <FiCpu size={11} /> Codebase
                        </button>
                        <button className="copilot-toolbar-btn" onClick={handleRunTestCases} disabled={testCasesLoading}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 11, fontWeight: 600, background: 'var(--orca-bg-elevated)', border: '1px solid var(--orca-border)', borderRadius: 6, cursor: 'pointer', color: 'var(--orca-green)', transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--orca-green)'; e.currentTarget.style.background = 'rgba(63,185,80,0.1)' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--orca-border)'; e.currentTarget.style.background = 'var(--orca-bg-elevated)' }}>
                            {testCasesLoading ? <div className="spinner" style={{ width: 10, height: 10 }} /> : <FiPlay size={11} />} Tests
                        </button>
                        <button className="copilot-toolbar-btn" onClick={() => { setActiveTab('security'); runFeatureAnalysis('security') }}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 11, fontWeight: 600, background: 'var(--orca-bg-elevated)', border: '1px solid var(--orca-border)', borderRadius: 6, cursor: 'pointer', color: 'var(--orca-orange)', transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--orca-orange)'; e.currentTarget.style.background = 'rgba(240,136,62,0.1)' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--orca-border)'; e.currentTarget.style.background = 'var(--orca-bg-elevated)' }}>
                            <FiShield size={11} /> Bugs
                        </button>
                        <button className="copilot-toolbar-btn" onClick={handleCreateSandbox} disabled={sandboxLoading}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 11, fontWeight: 700, background: 'var(--orca-gradient-vivid)', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'white', transition: 'all 0.15s' }}>
                            {sandboxLoading ? <div className="spinner" style={{ width: 10, height: 10 }} /> : '🧪'} Sandbox
                        </button>
                    </div>

                    {/* Chat messages */}
                    <div className="copilot-panel-inner" style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 14, paddingBottom: 14 }}>
                        {copilotMessages.slice(1).map((msg, i) => (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                                {msg.role === 'user' ? (
                                    <div className="chat-bubble-user">{msg.content}</div>
                                ) : (
                                    <div className="chat-bubble-assistant">
                                        <div className="markdown-content copilot-response" style={{ fontSize: 13 }}>
                                            <ReactMarkdown rehypePlugins={[rehypeHighlight]} components={markdownComponents}>{msg.content}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {copilotLoading && (
                            <div className="chat-bubble-assistant" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--orca-text-muted)' }}>
                                <div className="spinner" style={{ width: 13, height: 13 }} /> Thinking...
                            </div>
                        )}
                        <div ref={copilotEndRef} />
                    </div>

                    {/* Input area */}
                    <div style={{ padding: '12px 14px', borderTop: '1px solid var(--orca-border)', background: 'var(--orca-bg-elevated)', flexShrink: 0 }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                            <input className="input-field"
                                placeholder="Ask about this project..."
                                value={copilotInput}
                                onChange={e => setCopilotInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCopilotSend()}
                                style={{ fontSize: 13, background: 'var(--orca-bg)', borderColor: 'var(--orca-border)', color: 'var(--orca-text)', padding: '8px 12px' }}
                            />
                            <button className="btn-send" onClick={handleCopilotSend} disabled={copilotLoading || !copilotInput.trim()}>
                                <FiSend size={13} /> Send
                            </button>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--orca-text-muted)', cursor: 'pointer' }}>
                            <input type="checkbox" checked={useCopilot} onChange={e => setUseCopilot(e.target.checked)} style={{ accentColor: 'var(--orca-accent)' }} />
                            Enable AI-powered responses
                        </label>
                    </div>

                    {/* Quick actions moved to toolbar above — this area intentionally left empty */}
                </div>
            </div>

            {/* ── Modals ── */}
            {showPreviewModal && (
                <LivePreview files={previewFiles} title={`Preview — ${selectedRepo?.repo}`} onClose={() => setShowPreviewModal(false)} />
            )}
            {showCommitModal && (
                <CommitModal modifiedFiles={editedFiles} onConfirm={handlePush} onClose={() => setShowCommitModal(false)} pushing={pushing} />
            )}
            {showAgent && (
                <CodingAgentPanel projectRoot={`${selectedRepo.owner}/${selectedRepo.repo}`} onClose={() => setShowAgent(false)} onApply={() => {}} />
            )}
            {analysisModal && (
                <AnalysisModal
                    {...analysisModal}
                    onClose={() => setAnalysisModal(null)}
                />
            )}

            {/* Real online terminal test results */}
            {testCasesModal && (
                <TerminalModal
                    title={`Testing ${selectedRepo?.owner}/${selectedRepo?.repo}`}
                    content={testCasesModal.content}
                    lines={testCasesModal.lines}
                    loading={testCasesModal.loading}
                    error={testCasesModal.error}
                    autoDebug={testAutoDebug}
                    testResults={testResults}
                    testMeta={testMeta || { owner: selectedRepo?.owner, repo: selectedRepo?.repo }}
                    onClose={() => { setTestCasesModal(null); setTestAutoDebug(null); setTestResults(null); setTestMeta(null) }}
                />
            )}
            {/* AI Code Review Popup */}
            {codeReviewPopup && (
                <CodeReviewPopup
                    code={codeReviewPopup.code}
                    filename={codeReviewPopup.filename}
                    onClose={() => setCodeReviewPopup(null)}
                    onApply={(newCode) => {
                        if (fileName) {
                            setFileCode(newCode)
                            setEditedFiles(prev => ({ ...prev, [fileName]: newCode }))
                        }
                    }}
                />
            )}
            {toast && <Toast {...toast} onClose={() => setToast(null)} />}

            {/* Mapping & Architecture Panels */}
            {showMapping && selectedRepo && (
                <MappingPanel
                    owner={selectedRepo.owner}
                    repo={selectedRepo.repo}
                    filePaths={getSourceFilePaths()}
                    onClose={() => setShowMapping(false)}
                    onOpenFile={loadFile}
                />
            )}

            {showArchitecture && selectedRepo && (
                <ArchitecturePanel
                    owner={selectedRepo.owner}
                    repo={selectedRepo.repo}
                    filePaths={getSourceFilePaths()}
                    onClose={() => setShowArchitecture(false)}
                    onOpenFile={loadFile}
                />
            )}

            {/* ORCA Popups */}
            {showPlanning && <PlanningPopup files={Object.keys(editedFiles).length > 0 ? { ...originalFiles, ...editedFiles } : originalFiles} appIdea={selectedRepo ? `${selectedRepo.owner}/${selectedRepo.repo}` : ''} onClose={() => setShowPlanning(false)} />}
            {showSecurity && <SecurityPopup files={Object.keys(editedFiles).length > 0 ? { ...originalFiles, ...editedFiles } : originalFiles} onUpdateFile={(name, content) => { setEditedFiles(prev => ({ ...prev, [name]: content })); if (name === fileName) setFileCode(content) }} onClose={() => setShowSecurity(false)} />}
            {showCompliance && <CompliancePopup files={Object.keys(editedFiles).length > 0 ? { ...originalFiles, ...editedFiles } : originalFiles} onUpdateFile={(name, content) => { setEditedFiles(prev => ({ ...prev, [name]: content })); if (name === fileName) setFileCode(content) }} onClose={() => setShowCompliance(false)} />}
            {showDeployments && <DeploymentsPopup files={Object.keys(editedFiles).length > 0 ? { ...originalFiles, ...editedFiles } : originalFiles} repoName={selectedRepo?.repo || 'orca-app'} onClose={() => setShowDeployments(false)} />}
            {showSandboxPopup && fileName && (
                <SandboxPopup
                    fileName={fileName}
                    code={fileCode}
                    onClose={() => setShowSandboxPopup(false)}
                    onUpdateFile={(name, content) => {
                        setEditedFiles(prev => ({ ...prev, [name]: content }))
                        if (name === fileName) setFileCode(content)
                    }}
                    repoName={selectedRepo?.repo || 'orca-app'}
                />
            )}
        </div>
    )
}
