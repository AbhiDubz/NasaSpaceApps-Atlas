/**
 * Investigation document persistence — Supabase when signed in, localStorage
 * as a local cache / offline fallback.
 */
import { parseInvestigation, InvestigationSchema } from './investigationSchema.js'
import { supabase } from '../services/supabase.js'

const KEY_PREFIX = 'atlas_investigation_'

/**
 * @param {string} workspaceId
 * @returns {import('./investigationSchema.js').Investigation | null}
 */
export function loadInvestigationForWorkspace(workspaceId) {
  if (!workspaceId) return null
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${workspaceId}`)
    if (!raw) return null
    const parsed = parseInvestigation(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/**
 * @param {string} workspaceId
 * @param {import('./investigationSchema.js').Investigation} investigation
 */
export function saveInvestigationForWorkspace(workspaceId, investigation) {
  if (!workspaceId || !investigation) return
  try {
    localStorage.setItem(`${KEY_PREFIX}${workspaceId}`, JSON.stringify(investigation))
  } catch { /* quota */ }

  // Fire-and-forget cloud sync when a session is available.
  void syncInvestigationToCloud(workspaceId, investigation)
}

/**
 * Prefer the cloud copy when available; fall back to localStorage.
 * @param {string} workspaceId
 * @returns {Promise<import('./investigationSchema.js').Investigation | null>}
 */
export async function loadInvestigationAsync(workspaceId) {
  if (!workspaceId) return null

  if (supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (token) {
        const res = await fetch(
          `/api/investigations?workspace_id=${encodeURIComponent(workspaceId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        if (res.ok) {
          const body = await res.json()
          if (body.ok && body.investigation) {
            // Keep localStorage as a warm cache of the cloud copy.
            try {
              localStorage.setItem(
                `${KEY_PREFIX}${workspaceId}`,
                JSON.stringify(body.investigation),
              )
            } catch { /* quota */ }
            return body.investigation
          }
        }
      }
    } catch {
      /* fall through to local */
    }
  }

  return loadInvestigationForWorkspace(workspaceId)
}

/**
 * @param {string} workspaceId
 * @param {import('./investigationSchema.js').Investigation} investigation
 */
async function syncInvestigationToCloud(workspaceId, investigation) {
  if (!supabase || !workspaceId || !investigation) return
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    if (!token) return

    await fetch('/api/investigations', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ workspace_id: workspaceId, document: investigation }),
    })
  } catch {
    /* offline / table not migrated yet — localStorage already saved */
  }
}

/**
 * Build a fresh investigation from workspace scope.
 * @param {Object} workspace — Supabase row
 */
export function buildInvestigationFromWorkspace(workspace) {
  const now = new Date().toISOString()
  const regions = workspace.focus_regions || []
  const keywords = workspace.keywords || []
  const scopeLabel = [
    regions.length ? regions.join(', ') : null,
    keywords.length ? keywords.join(' · ') : null,
  ].filter(Boolean).join(' — ') || 'Global scope'

  return InvestigationSchema.parse({
    id: `inv-${workspace.id}`,
    title: workspace.name || 'Investigation',
    industry: 'general',
    scope: {
      dimensions: workspace.active_dimensions?.length
        ? workspace.active_dimensions
        : undefined,
      query: keywords.join(' '),
    },
    evidence: [],
    entities: regions.map((iso) => ({
      id: `place-${iso}`,
      label: iso,
      kind: 'place',
      iso,
    })),
    connections: [],
    blocks: [{
      id: 'block-scope',
      kind: 'narrative',
      title: 'Scope',
      content: workspace.description || `Monitoring ${scopeLabel}.`,
    }],
    audit: { createdAt: now, updatedAt: now, revision: 1 },
  })
}
