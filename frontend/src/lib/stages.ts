import type { OpportunityStage } from './types'

export const OPEN_STAGES: OpportunityStage[] = ['prospecting', 'developing', 'proposing', 'closing']
export const ALL_STAGES: OpportunityStage[] = [...OPEN_STAGES, 'won', 'lost']

export function stageLabel(stage: OpportunityStage): string {
  return stage.charAt(0).toUpperCase() + stage.slice(1)
}

export function stageBadgeTone(
  stage: OpportunityStage,
): 'slate' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet' {
  switch (stage) {
    case 'prospecting':
      return 'slate'
    case 'developing':
      return 'sky'
    case 'proposing':
      return 'violet'
    case 'closing':
      return 'amber'
    case 'won':
      return 'emerald'
    case 'lost':
      return 'rose'
  }
}

export function nextOpenStage(stage: OpportunityStage): OpportunityStage | null {
  const idx = OPEN_STAGES.indexOf(stage)
  if (idx === -1 || idx === OPEN_STAGES.length - 1) return null
  return OPEN_STAGES[idx + 1]
}
