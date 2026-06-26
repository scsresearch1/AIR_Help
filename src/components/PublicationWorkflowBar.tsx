import { Link } from 'react-router-dom'
import type { PublicationWorkflowState } from '../lib/publicationWorkflow'

interface PublicationWorkflowBarProps {
  workflow: PublicationWorkflowState | null
  activeStep: 'abstract' | 'journals' | 'conferences'
  onClear?: () => void
}

const STEPS = [
  { id: 'abstract' as const, label: 'Abstract Analysis' },
  { id: 'journals' as const, label: 'Journal Fit', href: '/journal-insights' },
  { id: 'conferences' as const, label: 'Conference Deadlines', href: '/conference-tracker' },
]

export function PublicationWorkflowBar({
  workflow,
  activeStep,
  onClear,
}: PublicationWorkflowBarProps) {
  if (!workflow) return null

  return (
    <aside className="workflow-bar" aria-label="Publication planning workflow">
      <div className="workflow-bar__header">
        <span className="workflow-bar__eyebrow">Publication planning workflow</span>
        {onClear && (
          <button type="button" className="workflow-bar__clear" onClick={onClear}>
            Clear session
          </button>
        )}
      </div>

      <ol className="workflow-bar__steps">
        {STEPS.map((step, index) => {
          const isActive = step.id === activeStep
          const isComplete =
            (step.id === 'abstract' && activeStep !== 'abstract') ||
            (step.id === 'journals' && activeStep === 'conferences')

          return (
            <li
              key={step.id}
              className={[
                'workflow-bar__step',
                isActive ? 'workflow-bar__step--active' : '',
                isComplete ? 'workflow-bar__step--complete' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="workflow-bar__step-num" aria-hidden="true">
                {index + 1}
              </span>
              {step.href && !isActive ? (
                <Link to={step.href} className="workflow-bar__step-label">
                  {step.label}
                </Link>
              ) : (
                <span className="workflow-bar__step-label">{step.label}</span>
              )}
            </li>
          )
        })}
      </ol>

      {workflow.detectedThemes.length > 0 && (
        <div className="workflow-bar__themes">
          <span className="workflow-bar__themes-label">Research themes</span>
          <div className="journal-keywords">
            {workflow.detectedThemes.map((theme) => (
              <span key={theme} className="journal-keywords__tag">
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="workflow-bar__preview" title={workflow.abstractPreview}>
        Manuscript: {workflow.abstractPreview}
        {workflow.abstractPreview.length >= 120 ? '…' : ''}
      </p>
    </aside>
  )
}
