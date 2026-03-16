import { useState } from 'react'
import { FiClipboard, FiShield, FiCheckCircle, FiUploadCloud, FiFileText } from 'react-icons/fi'

export default function OrcaToolbar({ onPlanningClick, onSecurityClick, onComplianceClick, onDeploymentsClick, onDocumentationClick }) {
    return (
        <div className="orca-pill-toolbar">
            <button className="orca-pill-btn planning" onClick={onPlanningClick} title="Planning">
                <FiClipboard size={14} />
                <span>Planning</span>
            </button>
            <button className="orca-pill-btn security" onClick={onSecurityClick} title="Security">
                <FiShield size={14} />
                <span>Security</span>
            </button>
            <button className="orca-pill-btn compliance" onClick={onComplianceClick} title="Compliance">
                <FiCheckCircle size={14} />
                <span>Compliance</span>
            </button>
            <button className="orca-pill-btn deployments" onClick={onDeploymentsClick} title="Deployments">
                <FiUploadCloud size={14} />
                <span>Deployments</span>
            </button>
            <button className="orca-pill-btn documentation" onClick={onDocumentationClick} title="Documentation">
                <FiFileText size={14} />
                <span>Documentation</span>
            </button>
        </div>
    )
}
