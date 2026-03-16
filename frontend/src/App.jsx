import { Routes, Route } from 'react-router-dom'
import { useState } from 'react'
import Navbar from './components/Navbar'
import AIPanel from './components/AIPanel'
import Home from './pages/Home'
import Explorer from './pages/Explorer'
import AppCreator from './pages/AppCreator'
import Deploy from './pages/Deploy'
import Settings from './pages/Settings'
import Learning from './pages/Learning'
import Visualize from './pages/Visualize'
import GitHubCallback from './pages/GitHubCallback'

export default function App() {
    const [showAI, setShowAI] = useState(false)
    const [aiContext, setAIContext] = useState('')

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--orca-bg)' }}>
            {/* GitHubCallback renders full-screen — hide Navbar during OAuth redirect */}
            <Routes>
                <Route path="/auth/github/callback" element={<GitHubCallback />} />
                <Route path="*" element={
                    <>
                        <Navbar onToggleAI={() => setShowAI(!showAI)} showAI={showAI} />
                        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                            <div style={{ flex: 1, overflow: 'auto' }}>
                                <Routes>
                                    <Route path="/" element={<Home />} />
                                    <Route path="/explorer" element={<Explorer setAIContext={setAIContext} />} />
                                    <Route path="/creator" element={<AppCreator />} />
                                    <Route path="/deploy" element={<Deploy />} />
                                    <Route path="/learning" element={<Learning />} />
                                    <Route path="/visualize" element={<Visualize />} />
                                    <Route path="/settings" element={<Settings />} />
                                </Routes>
                            </div>
                            {showAI && (
                                <AIPanel context={aiContext} onClose={() => setShowAI(false)} />
                            )}
                        </div>
                    </>
                } />
            </Routes>
        </div>
    )
}

