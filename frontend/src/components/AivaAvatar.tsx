// frontend/src/components/AivaAvatar.tsx

'use client'

import React from 'react';

// This is the UPDATED SVG, structured for advanced animation.
// - A new `<g id="face-group">` is added to group all facial features for head tilting.
// - More detailed mouth shapes (visemes) are added to the <defs> for better lip-syncing.

export const AivaAvatar = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>((props, ref) => {
  return (
    <svg
      ref={ref}
      width="200"
      height="200"
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Hidden paths for more detailed mouth shapes (visemes) - reference paths only */}
      <defs>
        {/* Silence/Closed - neutral closed mouth */}
        <path id="mouth-sil" d="M 85 140 Q 100 142 115 140" />
        
        {/* P/B/M - pressed closed lips - slightly wider */}
        <path id="mouth-p" d="M 84 140 Q 100 143.5 116 140" />
        
        {/* S/T/D/N - stretched thin horizontally */}
        <path id="mouth-S" d="M 78 138 Q 100 140 122 138" />
        
        {/* F/V - lower lip bite - slightly open */}
        <path id="mouth-f" d="M 88 138 Q 95 143 100 141.5 Q 105 143 112 138" />
        
        {/* I/Y/E - wide stretched horizontally */}
        <path id="mouth-i" d="M 72 136 Q 100 133 128 136" />
        
        {/* U/O/W - rounded pursed - more pronounced */}
        <path id="mouth-u" d="M 93 138 Q 100 150 107 138" />
        
        {/* A - wide open oval - very open */}
        <path id="mouth-a" d="M 88 133 Q 83 152 100 154 Q 117 152 112 133" />
        
        {/* R/L - slight pucker - rounded */}
        <path id="mouth-r" d="M 90 140 Q 98 148 102 148 Q 106 148 110 140" />
      </defs>

      {/* Main Head Structure */}
      <circle cx="100" cy="100" r="80" fill="#E0E0E0" stroke="#BDBDBD" strokeWidth="2" />
      
      {/* NEW: Group for all facial features to allow for head tilting */}
      <g id="face-group">
        {/* Eyes with blinking lids */}
        <g id="eyes-group">
          <circle cx="75" cy="90" r="8" fill="white" />
          <circle cx="75" cy="90" r="4" fill="black" />
          <path id="eyelid-left" d="M 65 82 Q 75 78 85 82" stroke="#BDBDBD" strokeWidth="2" fill="#E0E0E0" />
          
          <circle cx="125" cy="90" r="8" fill="white" />
          <circle cx="125" cy="90" r="4" fill="black" />
          <path id="eyelid-right" d="M 115 82 Q 125 78 135 82" stroke="#BDBDBD" strokeWidth="2" fill="#E0E0E0" />
        </g>
        
        {/* The visible mouth that will be animated */}
        <path
          id="mouth-live"
          d="M 85 140 Q 100 142 115 140" // Starts in the "silence" state - matches mouth-sil
          stroke="black"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
});

AivaAvatar.displayName = 'AivaAvatar';
