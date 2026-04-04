import type { CSSProperties } from "react"

interface BeetIconProps {
  className?: string
  style?: CSSProperties
}

export function BeetIcon({ className, style }: BeetIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Beet root body */}
      <ellipse cx="12" cy="17" rx="6.5" ry="5.5" />
      {/* Taproot */}
      <line x1="12" y1="22.5" x2="12" y2="20.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* Center stem */}
      <line x1="12" y1="11.5" x2="12" y2="7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* Left leaf */}
      <path d="M12 10 C10.5 7 6.5 6 7.5 9.5 C8 11.5 11 11 12 10Z" />
      {/* Right leaf */}
      <path d="M12 10 C13.5 7 17.5 6 16.5 9.5 C16 11.5 13 11 12 10Z" />
    </svg>
  )
}
