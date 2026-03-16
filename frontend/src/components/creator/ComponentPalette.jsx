import { FiX } from 'react-icons/fi'

const COMPONENTS = [
    {
        name: 'Button',
        icon: '🔘',
        description: 'Call-to-action button',
        html: `<button style="padding: 12px 28px; background: linear-gradient(135deg, #7c6aff, #9d6fff); color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(124,106,255,0.4)'" onmouseout="this.style.transform='';this.style.boxShadow=''">Click Me</button>`,
    },
    {
        name: 'Card',
        icon: '🃏',
        description: 'Content card with shadow',
        html: `<div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 360px; margin: 16px;">
  <h3 style="margin: 0 0 8px; font-size: 18px; color: #1a1a2e;">Card Title</h3>
  <p style="margin: 0; color: #666; line-height: 1.6;">This is a versatile content card. Replace this text with your own content.</p>
</div>`,
    },
    {
        name: 'Navbar',
        icon: '🧭',
        description: 'Navigation bar',
        html: `<nav style="display: flex; align-items: center; justify-content: space-between; padding: 16px 32px; background: #1a1a2e; color: white;">
  <div style="font-size: 20px; font-weight: 700;">Brand</div>
  <div style="display: flex; gap: 24px;">
    <a href="#" style="color: white; text-decoration: none; opacity: 0.8; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">Home</a>
    <a href="#" style="color: white; text-decoration: none; opacity: 0.8; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">About</a>
    <a href="#" style="color: white; text-decoration: none; opacity: 0.8; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">Contact</a>
  </div>
</nav>`,
    },
    {
        name: 'Hero',
        icon: '🦸',
        description: 'Hero section with CTA',
        html: `<section style="padding: 80px 32px; text-align: center; background: linear-gradient(135deg, #0d0d1a, #1a1530);">
  <h1 style="font-size: 48px; font-weight: 800; color: white; margin: 0 0 16px;">Build Something Amazing</h1>
  <p style="font-size: 18px; color: #9988cc; max-width: 600px; margin: 0 auto 32px; line-height: 1.6;">Create beautiful, modern web applications with the power of AI. No coding experience needed.</p>
  <button style="padding: 14px 36px; background: linear-gradient(135deg, #7c6aff, #bc8cff); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">Get Started</button>
</section>`,
    },
    {
        name: 'Footer',
        icon: '🦶',
        description: 'Page footer',
        html: `<footer style="padding: 32px; background: #0d0d1a; color: #9988cc; text-align: center; border-top: 1px solid #2d2640;">
  <div style="display: flex; justify-content: center; gap: 24px; margin-bottom: 16px;">
    <a href="#" style="color: #9988cc; text-decoration: none;">Privacy</a>
    <a href="#" style="color: #9988cc; text-decoration: none;">Terms</a>
    <a href="#" style="color: #9988cc; text-decoration: none;">Contact</a>
  </div>
  <p style="margin: 0; font-size: 13px;">© 2026 Your Company. All rights reserved.</p>
</footer>`,
    },
    {
        name: 'Form',
        icon: '📝',
        description: 'Contact form',
        html: `<form style="max-width: 480px; margin: 32px auto; padding: 32px; background: #1a1530; border-radius: 12px; border: 1px solid #2d2640;" onsubmit="event.preventDefault(); alert('Form submitted!')">
  <h3 style="margin: 0 0 20px; color: white; font-size: 20px;">Contact Us</h3>
  <input type="text" placeholder="Your Name" style="width: 100%; padding: 12px 16px; margin-bottom: 12px; background: #0d0d1a; border: 1px solid #2d2640; border-radius: 8px; color: white; font-size: 14px; outline: none; box-sizing: border-box;" />
  <input type="email" placeholder="Email Address" style="width: 100%; padding: 12px 16px; margin-bottom: 12px; background: #0d0d1a; border: 1px solid #2d2640; border-radius: 8px; color: white; font-size: 14px; outline: none; box-sizing: border-box;" />
  <textarea placeholder="Your Message" rows="4" style="width: 100%; padding: 12px 16px; margin-bottom: 16px; background: #0d0d1a; border: 1px solid #2d2640; border-radius: 8px; color: white; font-size: 14px; outline: none; resize: vertical; box-sizing: border-box;"></textarea>
  <button type="submit" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #7c6aff, #9d6fff); color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer;">Send Message</button>
</form>`,
    },
]

export default function ComponentPalette({ onInsert, onClose }) {
    return (
        <div className="creator-component-palette">
            <div className="creator-palette-header">
                <span>Components</span>
                <button className="creator-icon-btn" onClick={onClose}><FiX size={14} /></button>
            </div>
            <div className="creator-palette-grid">
                {COMPONENTS.map(comp => (
                    <div
                        key={comp.name}
                        className="creator-palette-item"
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.setData('text/html', comp.html)
                            e.dataTransfer.effectAllowed = 'copy'
                        }}
                        onClick={() => onInsert(comp.html)}
                    >
                        <span className="creator-palette-icon">{comp.icon}</span>
                        <span className="creator-palette-name">{comp.name}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
