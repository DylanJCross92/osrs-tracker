import { describe, it, expect } from 'vitest'
import { layoutFlow } from '@/components/admin/stats/flowLayout'

const flow = {
  nodes: [
    { id: '0:Home', col: 0, count: 10, left: false },
    { id: '1:Player', col: 1, count: 6, left: false },
    { id: '1:Planner', col: 1, count: 2, left: false },
    { id: '1:left', col: 1, count: 2, left: true },
  ],
  links: [
    { id: 'a', from: '0:Home', to: '1:Player', count: 6 },
    { id: 'b', from: '0:Home', to: '1:Planner', count: 2 },
    { id: 'c', from: '0:Home', to: '1:left', count: 2 },
  ],
}

describe('layoutFlow', () => {
  it('makes a box as tall as its people, on one scale for every column', () => {
    const { nodes } = layoutFlow(flow, { width: 400, height: 220, gap: 10 })
    const home = nodes.find((n) => n.id === '0:Home')
    const player = nodes.find((n) => n.id === '1:Player')
    expect(player.h / home.h).toBeCloseTo(0.6, 5)
  })
  it('puts columns left to right and boxes in a column without overlap', () => {
    const { nodes } = layoutFlow(flow, { width: 400, height: 220, nodeWidth: 10 })
    expect(nodes.find((n) => n.col === 1).x).toBe(390)
    const col = nodes.filter((n) => n.col === 1).sort((a, b) => a.y - b.y)
    for (let i = 1; i < col.length; i++) expect(col[i].y).toBeGreaterThanOrEqual(col[i - 1].y + col[i - 1].h)
  })
  it('draws a ribbon as thick as the people on it, leaving and arriving inside the boxes', () => {
    const { nodes, links } = layoutFlow(flow, { width: 400, height: 220 })
    const home = nodes.find((n) => n.id === '0:Home')
    expect(links.reduce((s, l) => s + l.w, 0)).toBeCloseTo(home.h, 5)
    for (const l of links) expect(l.d).toMatch(/^M[\d.]+,[\d.]+ C/)
  })
  it('copes with nothing to draw', () => {
    expect(layoutFlow({ nodes: [], links: [] })).toMatchObject({ nodes: [], links: [] })
    expect(layoutFlow(null).nodes).toEqual([])
  })
})
