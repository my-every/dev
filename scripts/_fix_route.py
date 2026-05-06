import re

with open('scripts/estimate-panel-wire-base-length.mjs', 'r') as f:
    content = f.read()

# Find start: "  // Two possible routes through the panel cable duct:"
# Find end: the closing "}\n}" of routeDistance
# We'll replace everything from the "Two possible routes" comment 
# up to (and including) the two closing braces of routeDistance.

START_MARKER = '  // Two possible routes through the panel cable duct:'
# Find the marker
start_idx = content.find(START_MARKER)
if start_idx == -1:
    print("Start marker not found!")
    exit(1)

# From start_idx, find the pattern: \n}\n\n (function closing brace + blank line)
# This is "}\n}" where the outer } closes routeDistance
end_pattern = '\n}\n'
end_idx = content.find(end_pattern, start_idx)
if end_idx == -1:
    print("End marker not found!")
    exit(1)

# Include the closing brace
end_idx = end_idx + len(end_pattern)

old_block = content[start_idx:end_idx]
print(f"Found block ({len(old_block)} chars):")
print(repr(old_block[:200]))
print("...")

new_block = """  // Sum vertical drops from ri1 to ri2 (using consecutive-rail drop map)
  let totalVerticalDropIn = 0
  for (let ri = ri1; ri < ri2; ri++) {
    totalVerticalDropIn += railDropMap?.get(ri) ?? 0
  }

  // Route A (right duct):  device -> right end of rail ri1
  //                        -> drop vertically to ri2 level
  //                        -> right end of rail ri2 -> device
  const routeA = (d1.railLengthIn - d1.posIn) + totalVerticalDropIn + (d2.railLengthIn - d2.posIn)

  // Route B (left duct):   device -> left end of rail ri1
  //                        -> drop vertically to ri2 level
  //                        -> left end of rail ri2 -> device
  const routeB = d1.posIn + totalVerticalDropIn + d2.posIn

  const minIn = Math.min(routeA, routeB)
  const maxIn = Math.max(routeA, routeB)
  const shortRoute = routeA <= routeB ? 'right duct' : 'left duct'
  const dropNote = totalVerticalDropIn > 0
    ? totalVerticalDropIn.toFixed(1) + '\\" drop'
    : 'no drop data'

  return {
    minIn,
    maxIn,
    shortRoute,
    verticalDropIn: totalVerticalDropIn,
    path: tag1 + '(rail ' + ri1 + ' @' + d1.posIn.toFixed(1) + '\\"/' + d1.railLengthIn + '") -> [' + dropNote + '] -> ' + tag2 + '(rail ' + ri2 + ' @' + d2.posIn.toFixed(1) + '\\"/' + d2.railLengthIn + '")',
  }
}
"""

content = content[:start_idx] + new_block + content[end_idx:]

with open('scripts/estimate-panel-wire-base-length.mjs', 'w') as f:
    f.write(content)

print("Done!")
