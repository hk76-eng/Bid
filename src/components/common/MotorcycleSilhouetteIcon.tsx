import React from 'react';

interface MotorcycleSilhouetteIconProps {
  className?: string;
  size?: number | string;
  color?: string;
}

/**
 * Bold White Motorcycle Silhouette Icon
 * High-fidelity vector recreation of the uploaded sportbike silhouette.
 */
export const MotorcycleSilhouetteIcon: React.FC<MotorcycleSilhouetteIconProps> = ({
  className = 'w-5 h-5',
  size,
  color = 'currentColor',
}) => {
  return (
    <svg
      viewBox="0 0 100 66"
      fill={color}
      className={className}
      style={size ? { width: size, height: size } : undefined}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Motorcycle"
    >
      {/* ======================================================== */}
      {/* 1. REAR WHEEL: Outer Tire + Inner Rim + Center Hub       */}
      {/* ======================================================== */}
      {/* Outer Tire Ring */}
      <path
        fillRule="evenodd"
        d="M 21.5 34 C 14.04 34 8 40.04 8 47.5 C 8 54.96 14.04 61 21.5 61 C 28.96 61 35 54.96 35 47.5 C 35 40.04 28.96 34 21.5 34 Z M 21.5 56.5 C 16.53 56.5 12.5 52.47 12.5 47.5 C 12.5 42.53 16.53 38.5 21.5 38.5 C 26.47 38.5 30.5 42.53 30.5 47.5 C 30.5 52.47 26.47 56.5 21.5 56.5 Z"
      />
      {/* Center Wheel Hub */}
      <circle cx="21.5" cy="47.5" r="4.8" />

      {/* ======================================================== */}
      {/* 2. FRONT WHEEL: Outer Tire + Inner Rim + Center Hub      */}
      {/* ======================================================== */}
      {/* Outer Tire Ring */}
      <path
        fillRule="evenodd"
        d="M 81.5 34 C 74.04 34 68 40.04 68 47.5 C 68 54.96 74.04 61 81.5 61 C 88.96 61 95 54.96 95 47.5 C 95 40.04 88.96 34 81.5 34 Z M 81.5 56.5 C 76.53 56.5 72.5 52.47 72.5 47.5 C 72.5 42.53 76.53 38.5 81.5 38.5 C 86.47 38.5 90.5 42.53 90.5 47.5 C 90.5 52.47 86.47 56.5 81.5 56.5 Z"
      />
      {/* Center Wheel Hub */}
      <circle cx="81.5" cy="47.5" r="4.8" />

      {/* ======================================================== */}
      {/* 3. FRONT FORK STRUT: Connecting Front Hub to Handlebars  */}
      {/* ======================================================== */}
      <path
        d="M 81.5 45 L 75.5 22.5 L 72.5 23.5 L 78.5 46.5 Z"
      />

      {/* ======================================================== */}
      {/* 4. MAIN MOTORCYCLE CHASSIS, FAIRINGS, TANK, SEAT, TAIL   */}
      {/* ======================================================== */}
      <path
        fillRule="evenodd"
        d="
          M 56.5 12
          C 58 12 65 12 65.5 12
          C 67.5 12 67.5 15.5 65.5 15.5
          L 60 16.5
          L 67 22
          L 72.5 17
          C 74.5 19 82 25.5 86 29
          L 88 33.5
          C 86.5 35 83 36.5 81 37
          L 86.5 43
          L 78.5 40
          L 74 31
          L 71 31
          L 76 46
          C 74 48 70 51 64.5 52.5
          C 59 54 48 54 44 54
          C 39 54 36.5 51 36 47
          L 28 47
          C 25 43.5 20 42 16 43
          L 26 38
          C 30 38 34 36 36.5 33.5
          C 39 31 43 27 50.5 25.5
          C 56 24 61 24.5 64.5 25.5
          L 67 21
          Z

          /* Headlight Cutout Slit */
          M 78 32
          L 85 34.5
          L 85 40
          L 80.5 36.5
          Z

          /* Engine Cooling Fin Vent 1 (Top) */
          M 49 39
          L 61 37.5
          L 60 40
          L 49 41
          Z

          /* Engine Cooling Fin Vent 2 (Middle) */
          M 50 42.5
          L 59 41.5
          L 58 44
          L 50 44.5
          Z

          /* Engine Cooling Fin Vent 3 (Bottom) */
          M 51 46
          L 57 45.5
          L 56.5 48
          L 51.5 48.2
          Z

          /* Circular Alternator / Clutch Cover Relief */
          M 45 46.5
          A 4 4 0 1 0 45 53.5
          A 4 4 0 1 0 45 46.5
          Z
        "
      />

      {/* ======================================================== */}
      {/* 5. UPSWEPT SPORT TAIL COWL SECTION                       */}
      {/* ======================================================== */}
      <path
        d="
          M 37 33
          L 8 26
          L 15 33
          C 21 37 28 41 33.5 40
          L 37 45
          L 34 37
          Z
        "
      />

      {/* ======================================================== */}
      {/* 6. SWINGARM: Connecting Rear Hub to Engine Pivot         */}
      {/* ======================================================== */}
      <path
        d="
          M 21.5 45.5
          L 38 45.5
          L 38 49
          L 21.5 49
          Z
        "
      />
    </svg>
  );
};
