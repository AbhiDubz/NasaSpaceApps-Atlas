import React from 'react'

function GlassEffect({ children, className = '', style = {}, href, target = '_blank' }) {
  const glassStyle = {
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.28)',
    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
    ...style,
  }

  const content = (
    <div
      className={`relative flex font-semibold overflow-hidden text-white cursor-pointer transition-opacity duration-300 ${className}`}
      style={glassStyle}
    >
      <div
        className="absolute inset-0 z-0 overflow-hidden rounded"
        style={{
          backdropFilter: 'blur(3px)',
          filter: 'url(#glass-distortion)',
          isolation: 'isolate',
        }}
      />
      <div
        className="absolute inset-0 z-10"
        style={{ background: 'rgba(255, 255, 255, 0.05)' }}
      />
      <div
        className="absolute inset-0 z-20 rounded overflow-hidden"
        style={{
          boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
        }}
      />
      <div className="relative z-30">{children}</div>
    </div>
  )

  return href ? (
    <a href={href} target={target} rel="noopener noreferrer" className="block">
      {content}
    </a>
  ) : (
    content
  )
}

export function GlassButton({ children, onClick, disabled, className = '' }) {
  return (
    <GlassEffect
      className={`rounded px-10 py-5 overflow-hidden items-center justify-center ${className}`}
    >
      <button
        onClick={onClick}
        disabled={disabled}
        className={`transition-opacity duration-300 cursor-pointer bg-transparent border-none text-inherit font-inherit
                    ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90'}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {children}
      </button>
    </GlassEffect>
  )
}

export function GlassFilter() {
  return (
    <svg style={{ display: 'none' }} aria-hidden>
      <filter
        id="glass-distortion"
        x="0%"
        y="0%"
        width="100%"
        height="100%"
        filterUnits="objectBoundingBox"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.001 0.005"
          numOctaves="1"
          seed="17"
          result="turbulence"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="turbulence"
          scale="8"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  )
}
