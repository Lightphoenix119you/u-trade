import { campusThemeVars } from '@/lib/format';
import type { Campus } from '@/lib/types';

export function MeshBackground({ campus }: { campus: Campus | null }) {
  const vars = campusThemeVars(campus);
  const cssVars = vars as React.CSSProperties;

  return (
    <div className="mesh-bg" style={cssVars}>
      <div className="mesh-orb mesh-orb-1" />
      <div className="mesh-orb mesh-orb-2" />
      <div className="mesh-orb mesh-orb-3" />
      <div className="mesh-orb mesh-orb-4" />
      <div className="mesh-grid" />
    </div>
  );
}
