import { FiCode } from 'react-icons/fi'

const FRAMEWORKS = [
    { value: 'html_css_js', label: 'HTML / CSS / JS', icon: '🌐' },
    { value: 'react_vite', label: 'React + Vite', icon: '⚛️' },
    { value: 'react_tailwind', label: 'React + Tailwind', icon: '🎨' },
    { value: 'react_shadcn', label: 'React + shadcn/ui', icon: '🧩' },
    { value: 'vue', label: 'Vue 3 + Vite', icon: '💚' },
    { value: 'vue_vite_tailwind', label: 'Vue 3 + Tailwind', icon: '💚' },
    { value: 'svelte_vite', label: 'Svelte + Vite', icon: '🔶' },
    { value: 'nextjs', label: 'Next.js', icon: '▲' },
    { value: 'astro', label: 'Astro', icon: '🚀' },
    { value: 'angular', label: 'Angular', icon: '🅰️' },
    { value: 'solidjs', label: 'Solid.js', icon: '⚡' },
    { value: 'vanilla_gsap', label: 'Vanilla JS + GSAP', icon: '✨' },
    { value: 'html_bootstrap', label: 'HTML + Bootstrap 5', icon: '🅱️' },
    { value: 'html_bulma', label: 'HTML + Bulma CSS', icon: '💎' },
    { value: 'fastapi', label: 'FastAPI', icon: '⚡' },
    { value: 'flask', label: 'Flask', icon: '🔥' },
    { value: 'react_fastapi', label: 'Full-Stack (React+FastAPI)', icon: '🚀' },
]

export default function FrameworkSelector({ value, onChange, disabled }) {
    return (
        <div className="creator-framework-selector">
            <div className="creator-section-header">
                <span><FiCode size={13} /> FRAMEWORK</span>
            </div>
            <select
                className="creator-framework-select"
                value={value}
                onChange={e => onChange(e.target.value)}
                disabled={disabled}
            >
                {FRAMEWORKS.map(fw => (
                    <option key={fw.value} value={fw.value}>
                        {fw.icon} {fw.label}
                    </option>
                ))}
            </select>
        </div>
    )
}
