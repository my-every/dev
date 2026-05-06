#!/usr/bin/env python3
"""Delete the garbage duplicate block after routeDistance function."""

path = '/Users/billytruong/Desktop/Shared/app/main/scripts/estimate-panel-wire-base-length.mjs'
lines = open(path).readlines()
print(f'Total lines: {len(lines)}')

# Find the first '}' after the clean return block in routeDistance
# The clean function ends with:
#   }
# }
# Then garbage starts.
# We know routeDistance starts at line 351 (index 350)
# We'll find the FIRST line that is just "}\n" after the return {
# by finding "verticalDropIn: totalVerticalDropIn," and counting forward

vdrop_line = next(i for i,l in enumerate(lines) if 'verticalDropIn: totalVerticalDropIn,' in l)
print(f'verticalDropIn line: {vdrop_line+1}')

# After vdrop_line, find the pattern: "  }\n" then "}\n" (closing return + function)
func_close = None
for i in range(vdrop_line, vdrop_line+10):
    if lines[i].strip() == '}' and lines[i+1].strip() == '}':
        func_close = i+1  # index of the '}' closing routeDistance
        break

if func_close is None:
    # find single } line
    for i in range(vdrop_line, vdrop_line+10):
        if lines[i].rstrip() == '}':
            func_close = i
            break

print(f'routeDistance closes at line: {func_close+1}')
print(f'Line {func_close+1}: {repr(lines[func_close])}')
print(f'Line {func_close+2}: {repr(lines[func_close+1])}')

# Find Sheet resolver line
resolver_idx = next(i for i,l in enumerate(lines) if 'Sheet resolver' in l)
print(f'Sheet resolver at line: {resolver_idx+1}')

# Lines func_close+1 through resolver_idx-1 are garbage (but keep blank line before resolver)
# Actually we want to keep the blank line at resolver_idx-1
garbage_start = func_close + 1
garbage_end = resolver_idx - 1  # keep the blank line before resolver
print(f'Deleting lines {garbage_start+1} to {garbage_end} ({garbage_end - garbage_start} lines)')
print('Sample garbage:', repr(lines[garbage_start]))

del lines[garbage_start:garbage_end]
open(path, 'w').writelines(lines)
print(f'Done! New total: {len(open(path).readlines())} lines')
