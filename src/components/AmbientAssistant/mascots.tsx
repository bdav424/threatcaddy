import type { ReactElement } from 'react';
import type { AmbientAssistantCharacter } from '../../types';

/**
 * Ambient AI assistant mascots — a set of Clippy-style desk companions.
 *
 * Each mascot is a self-contained inline SVG so it themes with `currentColor`
 * where useful, needs no external asset, and stays crisp at any size. Animated
 * parts carry stable class names (`aa-part-*`) that the CSS in index.css drives:
 * a gentle idle motion always, plus a louder "signature" flourish while the
 * wrapper has `.is-waving`. Keep the viewBox 0 0 100 100 across all four so the
 * picker grid and the floating widget can swap them without re-layout.
 */

export interface MascotProps {
  size?: number;
  /** True while the mascot should play its signature flourish (hover / greeting). */
  waving?: boolean;
  className?: string;
  title?: string;
}

function svgProps(size: number | undefined, extra: string, waving?: boolean, title?: string) {
  return {
    width: size ?? 72,
    height: size ?? 72,
    viewBox: '0 0 100 100',
    className: `aa-mascot ${extra}${waving ? ' is-waving' : ''}`,
    role: 'img' as const,
    'aria-label': title,
    xmlns: 'http://www.w3.org/2000/svg',
  };
}

/** Edgar — the resident nerd. Big round glasses, cowlick, bow tie. */
export function EdgarMascot({ size, waving, className = '', title = 'Edgar' }: MascotProps) {
  return (
    <svg {...svgProps(size, `aa-edgar ${className}`, waving, title)}>
      <g className="aa-part-body">
        {/* sweater collar */}
        <path d="M28 96 Q50 78 72 96 Z" fill="#3f6f9f" />
        <path d="M42 88 L50 98 L58 88 Z" fill="#eef2f7" />
        {/* bow tie */}
        <path d="M50 86 L40 81 L40 91 Z" fill="#c0453b" />
        <path d="M50 86 L60 81 L60 91 Z" fill="#c0453b" />
        <circle cx="50" cy="86" r="2.6" fill="#8f2f27" />
        {/* head */}
        <circle cx="50" cy="46" r="27" fill="#f2c9a0" />
        {/* ears */}
        <circle cx="23" cy="47" r="5" fill="#e7b487" />
        <circle cx="77" cy="47" r="5" fill="#e7b487" />
        {/* hair */}
        <path d="M24 40 Q26 17 50 16 Q74 17 76 40 Q66 28 50 29 Q34 28 24 40 Z" fill="#5a3b26" />
        <path className="aa-part-cowlick" d="M50 16 Q54 6 60 9 Q55 12 55 18 Z" fill="#5a3b26" />
        {/* glasses */}
        <g fill="none" stroke="#2b2b32" strokeWidth="3">
          <circle cx="39" cy="47" r="11" fill="#dbeafe" />
          <circle cx="61" cy="47" r="11" fill="#dbeafe" />
          <line x1="50" y1="45" x2="50" y2="45" />
          <path d="M50 46 L52 46" />
        </g>
        <path d="M50 46 L52 46" stroke="#2b2b32" strokeWidth="3" />
        {/* glass glint */}
        <rect className="aa-part-glint" x="31" y="40" width="4" height="14" rx="2" fill="#ffffff" opacity="0.85" />
        {/* pupils */}
        <circle cx="39" cy="48" r="3" fill="#2b2b32" />
        <circle cx="61" cy="48" r="3" fill="#2b2b32" />
        {/* smile */}
        <path d="M42 62 Q50 69 58 62" fill="none" stroke="#a6673f" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Gopher — your "gopher": pops from the burrow to fetch what you need. */
export function GopherMascot({ size, waving, className = '', title = 'Gopher' }: MascotProps) {
  return (
    <svg {...svgProps(size, `aa-gopher ${className}`, waving, title)}>
      {/* body pops up out of the mound; the mound is drawn AFTER so it overlaps */}
      <g className="aa-part-pop">
        <ellipse cx="50" cy="58" rx="21" ry="24" fill="#b98a52" />
        <ellipse cx="50" cy="66" rx="13" ry="15" fill="#e6cfa8" />
        {/* ears */}
        <circle cx="33" cy="40" r="7" fill="#b98a52" />
        <circle cx="67" cy="40" r="7" fill="#b98a52" />
        <circle cx="33" cy="40" r="3.5" fill="#8f6636" />
        <circle cx="67" cy="40" r="3.5" fill="#8f6636" />
        {/* eyes */}
        <circle cx="42" cy="50" r="4.2" fill="#2b2118" />
        <circle cx="58" cy="50" r="4.2" fill="#2b2118" />
        <circle cx="43.4" cy="48.6" r="1.4" fill="#fff" />
        <circle cx="59.4" cy="48.6" r="1.4" fill="#fff" />
        {/* nose */}
        <ellipse cx="50" cy="58" rx="3.6" ry="2.6" fill="#7a4a2c" />
        {/* buck teeth */}
        <rect x="46.4" y="61" width="7.2" height="9" rx="1.6" fill="#fff" stroke="#cfc4ad" strokeWidth="0.8" />
        <line x1="50" y1="61" x2="50" y2="70" stroke="#cfc4ad" strokeWidth="0.8" />
        {/* whiskers */}
        <g stroke="#8f6636" strokeWidth="1" strokeLinecap="round">
          <line x1="34" y1="56" x2="44" y2="58" />
          <line x1="34" y1="61" x2="44" y2="61" />
          <line x1="66" y1="56" x2="56" y2="58" />
          <line x1="66" y1="61" x2="56" y2="61" />
        </g>
        {/* little paw holding a flag pin — the "fetch" gag */}
        <line className="aa-part-flag" x1="70" y1="72" x2="70" y2="52" stroke="#7a5a34" strokeWidth="2" strokeLinecap="round" />
        <path className="aa-part-flag" d="M70 52 L82 55 L70 60 Z" fill="#e0574d" />
        <circle cx="70" cy="74" r="5" fill="#e6cfa8" />
      </g>
      {/* dirt mound in front */}
      <path d="M12 84 Q50 66 88 84 L88 100 L12 100 Z" fill="#6b4a2b" />
      <ellipse cx="50" cy="84" rx="16" ry="5" fill="#4f3620" />
      <circle cx="26" cy="86" r="2" fill="#8a6238" />
      <circle cx="74" cy="88" r="2.4" fill="#8a6238" />
    </svg>
  );
}

/** Clip — the binder-clip Clippy homage (paperclip-adjacent, as requested). */
export function ClipMascot({ size, waving, className = '', title = 'Clip' }: MascotProps) {
  return (
    <svg {...svgProps(size, `aa-clip ${className}`, waving, title)}>
      {/* springy wire arms */}
      <g className="aa-part-arms" fill="none" stroke="#9aa4b2" strokeWidth="4" strokeLinecap="round">
        <path d="M40 52 Q30 22 46 18" />
        <path d="M60 52 Q70 22 54 18" />
      </g>
      {/* clip body (trapezoid) */}
      <path d="M34 50 L66 50 L60 92 L40 92 Z" fill="#2f333c" />
      <path d="M34 50 L66 50 L64.2 62 L35.8 62 Z" fill="#3c414c" />
      {/* metallic edge highlight */}
      <path d="M37 52 L40 90" stroke="#565d6b" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* googly eyes */}
      <circle cx="44" cy="66" r="7" fill="#fff" />
      <circle cx="56" cy="66" r="7" fill="#fff" />
      <circle className="aa-part-eye" cx="45" cy="67" r="3.2" fill="#1c1f26" />
      <circle className="aa-part-eye" cx="57" cy="67" r="3.2" fill="#1c1f26" />
      {/* smile */}
      <path d="M43 80 Q50 86 57 80" fill="none" stroke="#c9cfd8" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** Wilson — a golf ball with a face, perched on a tee. Fits the "Caddy" theme. */
export function WilsonMascot({ size, waving, className = '', title = 'Wilson' }: MascotProps) {
  const dimples: Array<[number, number]> = [
    [34, 34], [50, 30], [66, 34],
    [28, 48], [72, 48],
    [32, 64], [68, 64],
    [42, 58], [58, 58],
  ];
  return (
    <svg {...svgProps(size, `aa-wilson ${className}`, waving, title)}>
      {/* tee */}
      <path d="M46 86 L54 86 L52 98 L48 98 Z" fill="#d64f45" />
      <ellipse cx="50" cy="85" rx="9" ry="3" fill="#e56a60" />
      <g className="aa-part-ball">
        {/* ball */}
        <circle cx="50" cy="50" r="30" fill="#f6f7f9" stroke="#dfe3e8" strokeWidth="1.5" />
        {/* dimples */}
        <g fill="#e4e8ee">
          {dimples.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="2.4" />)}
        </g>
        {/* face — friendly, Cast Away style but kind */}
        <circle cx="42" cy="47" r="3.4" fill="#2b2b32" />
        <circle cx="58" cy="47" r="3.4" fill="#2b2b32" />
        <circle cx="43.1" cy="45.9" r="1" fill="#fff" />
        <circle cx="59.1" cy="45.9" r="1" fill="#fff" />
        <path d="M40 60 Q50 69 60 60" fill="none" stroke="#2b2b32" strokeWidth="2.6" strokeLinecap="round" />
        {/* rosy cheeks */}
        <circle cx="36" cy="56" r="3" fill="#f2b8ad" opacity="0.7" />
        <circle cx="64" cy="56" r="3" fill="#f2b8ad" opacity="0.7" />
      </g>
    </svg>
  );
}

export interface MascotDefinition {
  id: AmbientAssistantCharacter;
  name: string;
  /** One-liner shown under the name in the picker. */
  tagline: string;
  /** Accent colour for the picker card + speech bubble edge. */
  accent: string;
  Component: (props: MascotProps) => ReactElement;
  /** Rotating idle quips the mascot surfaces (kept in-character, harmless). */
  tips: string[];
}

export const AMBIENT_MASCOTS: MascotDefinition[] = [
  {
    id: 'edgar',
    name: 'Edgar',
    tagline: 'The resident nerd. Reads the footnotes so you don’t have to.',
    accent: '#3f6f9f',
    Component: EdgarMascot,
    tips: [
      'Tip: press ⌘K to jump straight to any investigation.',
      'Actually, that IOC looks like a defanged URL — want me to re-fang it?',
      'A well-labeled timeline event is a happy timeline event.',
      'Did you know? Every product can be templatized from a real docx.',
    ],
  },
  {
    id: 'gopher',
    name: 'Gopher',
    tagline: 'Your gopher — pops up to fetch whatever you need.',
    accent: '#b98a52',
    Component: GopherMascot,
    tips: [
      'Say the word and I’ll fetch the latest threat feed.',
      'Need that evidence item? I’ll dig it up.',
      'Burrowing through your notes… found three untagged ones.',
      'I fetched you a fresh scan job. You’re welcome.',
    ],
  },
  {
    id: 'clip',
    name: 'Clip',
    tagline: 'A binder-clip with opinions. It looks like you’re writing a report!',
    accent: '#565d6b',
    Component: ClipMascot,
    tips: [
      'It looks like you’re writing a report. Want a template?',
      'Two clips are better than one. So is a second reviewer.',
      'I hold things together. Like your draft checkpoints.',
      'Pinned it. Metaphorically and literally.',
    ],
  },
  {
    id: 'wilson',
    name: 'Wilson',
    tagline: 'A golf ball who believes in you. Fits the Caddy, naturally.',
    accent: '#d64f45',
    Component: WilsonMascot,
    tips: [
      'You’ve got this. I’m just here for moral support.',
      'Nice drive on that investigation. Keep going.',
      'Fore! ...sorry, force of habit. Carry on, Caddy.',
      'Stay on the fairway. Or, you know, close the ticket.',
    ],
  },
];

export function getMascot(id: AmbientAssistantCharacter | undefined): MascotDefinition {
  return AMBIENT_MASCOTS.find((m) => m.id === id) ?? AMBIENT_MASCOTS[0];
}
