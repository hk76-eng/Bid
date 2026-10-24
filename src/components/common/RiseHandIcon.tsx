import React from 'react';

interface RiseHandIconProps {
  className?: string;
  size?: number;
  color?: string;
}

export const RiseHandIcon: React.FC<RiseHandIconProps> = ({
  className = 'w-6 h-6',
  size = 24,
  color = 'currentColor',
}) => {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Passenger standing and hailing ride"
    >
      <circle cx="124" cy="72" r="39" />
      <path d="M 72,200 C 74,168 56,122 36,80 C 26,58 13,36 9,21 C 5,8 17,-1 29,4 C 38,9 47,25 58,52 C 70,82 86,112 106,124 C 114,117 128,114 142,118 C 162,124 180,152 196,200 Z" />
    </svg>
  );
};

export default RiseHandIcon;
