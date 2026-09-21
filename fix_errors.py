"""
Fix remaining TypeScript errors:
1. Blob([...buffer...]) where buffer is ArrayBuffer|SharedArrayBuffer -> cast to ArrayBuffer
2. Remove remaining unused downloadUint8Array imports
"""
import os, re

files = [
    'src/utils/fileUtils.ts',
    'src/services/imagesToPdf.ts',
    'src/pages/MergePage.ts',
    'src/pages/CompressPage.ts',
    'src/pages/SplitPage.ts',
    'src/pages/JpgToPdfPage.ts',
    'src/pages/ReorderPage.ts',
    'src/pages/DeletePagesPage.ts',
    'src/pages/RotatePagesPage.ts',
]

for path in files:
    if not os.path.exists(path):
        print(f'SKIP: {path}')
        continue
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    orig = content

    # Fix: .buffer.slice(...) returns ArrayBuffer|SharedArrayBuffer -> cast to ArrayBuffer
    content = re.sub(
        r'\.buffer\.slice\(([^)]+)\)',
        r'.buffer.slice(\1) as ArrayBuffer',
        content
    )

    # Also remove any remaining 'downloadUint8Array' from import lists (multi-line safe)
    # Pattern: line with just downloadUint8Array in an import
    content = re.sub(r',?\n\s+downloadUint8Array,?', '', content)
    content = re.sub(r'downloadUint8Array,?\n', '', content)

    if content != orig:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'FIXED: {path}')
    else:
        print(f'  OK : {path}')

print('Done.')
