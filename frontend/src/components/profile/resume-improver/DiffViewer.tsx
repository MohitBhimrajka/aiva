'use client'

import { useEffect, useRef } from 'react'
import { DiffMatchPatch } from 'diff-match-patch'

interface DiffViewerProps {
  original: string
  improved: string
}

export default function DiffViewer({ original, improved }: DiffViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || !original || !improved) return

    const dmp = new DiffMatchPatch()
    const diffs = dmp.diff_main(original, improved)
    dmp.diff_cleanupSemantic(diffs)

    const fragment = document.createDocumentFragment()

    diffs.forEach(([operation, text]) => {
      const lines = text.split('\n')

      lines.forEach((line, lineIndex) => {
        if (lineIndex > 0) {
          fragment.appendChild(document.createElement('br'))
        }
        if (line.trim()) {
          const lineSpan = document.createElement('span')
          lineSpan.textContent = line
          
          if (operation === 1) {
            // Added text (green)
            lineSpan.className = 'bg-green-100 text-green-800 px-1 rounded'
          } else if (operation === -1) {
            // Removed text (red)
            lineSpan.className = 'bg-red-100 text-red-800 px-1 rounded line-through'
          } else {
            // Unchanged text
            lineSpan.className = 'text-gray-700'
          }
          
          fragment.appendChild(lineSpan)
        } else if (lineIndex === 0 && line === '') {
          // Empty line
          fragment.appendChild(document.createTextNode(' '))
        }
      })
    })

    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(fragment)
  }, [original, improved])

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="mb-4 flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 bg-red-100 rounded"></span>
          <span>Removed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 bg-green-100 rounded"></span>
          <span>Added</span>
        </div>
      </div>
      <div
        ref={containerRef}
        className="font-mono text-sm whitespace-pre-wrap break-words"
        style={{ minHeight: '300px' }}
      />
    </div>
  )
}

