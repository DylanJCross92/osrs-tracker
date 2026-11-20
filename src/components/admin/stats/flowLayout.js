// Lays out the user-flow diagram: a column of boxes for each step, a box for each place people were at that step (as tall as the
// number of people there), and a ribbon between two boxes (as thick as the number of people who went from one to the other).
// Pure, so it is easy to test; the component only draws what this returns.

/**
 * flow: { nodes: [{ id, col, count, left }], links: [{ id, from, to, count }] } as the server sends it (nodes sorted by column).
 * Returns { nodes: [{ ...node, x, y, w, h }], links: [{ ...link, d, w }], height } for a drawing `width` wide.
 */
export function layoutFlow(flow, { width = 640, height = 340, nodeWidth = 10, gap = 10, labelRoom = 0 } = {}) {
  const nodes = (flow?.nodes || []).map((n) => ({ ...n }))
  const cols = nodes.length ? Math.max(...nodes.map((n) => n.col)) + 1 : 0
  if (!cols) return { nodes: [], links: [], height }
  const innerWidth = Math.max(1, width - labelRoom)
  const step = cols > 1 ? (innerWidth - nodeWidth) / (cols - 1) : 0
  const byCol = Array.from({ length: cols }, (_, c) => nodes.filter((n) => n.col === c))
  // One scale for every column, so the same number of people is the same height everywhere.
  const scale = Math.min(...byCol.filter((c) => c.length).map((c) => (height - gap * (c.length - 1)) / Math.max(1, c.reduce((s, n) => s + n.count, 0))))
  byCol.forEach((column, c) => {
    let y = 0
    for (const n of column) {
      n.x = c * step
      n.y = y
      n.w = nodeWidth
      n.h = Math.max(2, n.count * scale)
      y += n.h + gap
    }
  })
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out = new Map(nodes.map((n) => [n.id, 0]))
  const into = new Map(nodes.map((n) => [n.id, 0]))
  const links = (flow.links || []).filter((l) => byId.has(l.from) && byId.has(l.to))
  // Stack the ribbons in each box in the order of the boxes they join, so they do not cross more than they must.
  const sourceOrder = [...links].sort((a, b) => byId.get(a.from).y - byId.get(b.from).y || byId.get(a.to).y - byId.get(b.to).y)
  const targetOrder = [...links].sort((a, b) => byId.get(a.to).y - byId.get(b.to).y || byId.get(a.from).y - byId.get(b.from).y)
  const start = new Map()
  const end = new Map()
  for (const l of sourceOrder) {
    const w = Math.max(1, l.count * scale)
    start.set(l.id, out.get(l.from))
    out.set(l.from, out.get(l.from) + w)
  }
  for (const l of targetOrder) {
    const w = Math.max(1, l.count * scale)
    end.set(l.id, into.get(l.to))
    into.set(l.to, into.get(l.to) + w)
  }
  const laid = links.map((l) => {
    const a = byId.get(l.from)
    const b = byId.get(l.to)
    const w = Math.max(1, l.count * scale)
    const x0 = a.x + a.w
    const x1 = b.x
    const y0 = a.y + start.get(l.id) + w / 2
    const y1 = b.y + end.get(l.id) + w / 2
    const mid = (x0 + x1) / 2
    return { ...l, w, d: `M${x0},${y0} C${mid},${y0} ${mid},${y1} ${x1},${y1}` }
  })
  const used = Math.max(...byCol.map((c) => c.reduce((s, n) => s + n.h + gap, 0) - gap))
  return { nodes, links: laid, height: Math.max(used, 40) }
}
