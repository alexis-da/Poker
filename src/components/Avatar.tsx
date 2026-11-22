import type { CSSProperties } from 'react';

const PROFILE_COLORS: Record<string, string> = {
  roc: '#5f7180',
  reg: '#2d5ca6',
  lag: '#b3313a',
  station: '#c2821a',
  hero: '#d9b26a',
};

interface Props {
  name: string;
  profile: string | null;
  isHero?: boolean;
  active?: boolean;
  size?: number;
}

/** Médaillon du joueur : initiale sur la couleur de son profil. */
export function Avatar({ name, profile, isHero, active, size = 44 }: Props) {
  const color = PROFILE_COLORS[isHero ? 'hero' : (profile ?? 'reg')] ?? PROFILE_COLORS.reg;
  const style = { width: size, height: size, fontSize: size * 0.46, '--avatar': color } as CSSProperties;
  return (
    <span className={`avatar ${active ? 'avatar--active' : ''} ${isHero ? 'avatar--hero' : ''}`} style={style} aria-hidden="true">
      {isHero ? '★' : name.slice(0, 1)}
    </span>
  );
}
