/** REQUIREMENTS.md §8.1 -- "a subtle decorative touch in the header" enhancement:
 * a low-opacity geometric pattern layered behind the header content, instead
 * of a flat gradient. Purely decorative (aria-hidden, pointer-events-none) --
 * render as the header's first child so later siblings (logo, title, Home/
 * Exit controls) paint over it in normal stacking order, no z-index needed.
 * The header itself must have `relative overflow-hidden` for this to clip
 * correctly (already true everywhere -- every header already uses `relative`
 * for its absolutely-positioned Home/Exit controls). */
export function HeaderPattern() {
  return (
    <svg className="absolute inset-0 h-full w-full" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <pattern id="header-pattern" width="30" height="30" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
          <circle cx="5" cy="5" r="1.5" fill="white" />
          <circle cx="20" cy="20" r="1.5" fill="white" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#header-pattern)" opacity="0.08" />
    </svg>
  );
}
