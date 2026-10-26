// Catálogo de arcanos: emblemas propios (SVG simple, 100x100), estética rojo/negro/blanco.
// Dibujos originales: no reproducen arte de ningún juego ni baraja en particular.
(function () {
  'use strict';

  const L = (d) => `<path class="e-k" d="${d}"/><path class="e-w" d="${d}"/>`; // línea blanca con borde negro
  const F = (d) => `<path class="e-f" d="${d}"/>`;                              // relleno blanco
  const R = (d) => `<path class="e-r" d="${d}"/>`;                              // relleno acento
  const K = (d) => `<path class="e-b" d="${d}"/>`;                              // relleno negro
  const C = (cx, cy, r, cls) => `<circle class="${cls || 'e-f'}" cx="${cx}" cy="${cy}" r="${r}"/>`;
  const ring = (cx, cy, r) => L(`M${cx - r} ${cy} A${r} ${r} 0 1 1 ${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx - r} ${cy} Z`);

  const n1 = (v) => Math.round(v * 10) / 10;
  const pt = (cx, cy, deg, r) => {
    const a = (deg * Math.PI) / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const poly = (pts) => 'M' + pts.map((p) => `${n1(p[0])} ${n1(p[1])}`).join(' L') + ' Z';
  const star = (n, Ro, Ri) => {
    const pts = [];
    for (let i = 0; i < n * 2; i++) pts.push(pt(50, 50, -90 + (180 / n) * i, i % 2 ? Ri : Ro));
    return poly(pts);
  };
  const spokes = (cx, cy, r0, r1, n, off) => {
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = off + (360 / n) * i;
      const p0 = pt(cx, cy, a, r0);
      const p1 = pt(cx, cy, a, r1);
      d += `M${n1(p0[0])} ${n1(p0[1])} L${n1(p1[0])} ${n1(p1[1])} `;
    }
    return d.trim();
  };
  const heart = 'M50 86 C14 58 18 26 38 26 C46 26 50 34 50 38 C50 34 54 26 62 26 C82 26 86 58 50 86 Z';

  const ARCANA = [
    { id: 'fool', num: 0, roman: '0', name: 'Fool',
      draw: () => F('M50 8 L88 88 L50 68 L12 88 Z') + C(50, 56, 8, 'e-r') },

    { id: 'magician', num: 1, roman: 'I', name: 'Magician',
      draw: () =>
        L('M50 66 C65 41 90 41 90 66 C90 91 65 91 50 66 C35 41 10 41 10 66 C10 91 35 91 50 66 Z') +
        L('M50 26 L50 46') + R('M50 6 L58 16 L50 26 L42 16 Z') },

    { id: 'priestess', num: 2, roman: 'II', name: 'Priestess',
      draw: () =>
        F('M14 10 L34 10 L34 90 L14 90 Z') + R('M66 10 L86 10 L86 90 L66 90 Z') +
        C(50, 50, 13) + C(55, 46, 10, 'e-b') },

    { id: 'empress', num: 3, roman: 'III', name: 'Empress',
      draw: () => ring(50, 36, 22) + L('M50 58 L50 92') + L('M34 76 L66 76') + C(50, 36, 7, 'e-r') },

    { id: 'emperor', num: 4, roman: 'IV', name: 'Emperor',
      draw: () =>
        F('M14 70 L14 32 L34 50 L50 22 L66 50 L86 32 L86 70 Z') +
        R('M12 76 L88 76 L88 90 L12 90 Z') + C(50, 52, 6, 'e-r') },

    { id: 'hierophant', num: 5, roman: 'V', name: 'Hierophant',
      draw: () =>
        L('M50 10 L50 92') + L('M38 24 L62 24') + L('M31 42 L69 42') + L('M24 60 L76 60') +
        C(50, 10, 6, 'e-r') },

    { id: 'lovers', num: 6, roman: 'VI', name: 'Lovers',
      draw: () =>
        F(heart) +
        `<g transform="translate(50 54) scale(.5) translate(-50 -54)">${R(heart)}</g>` },

    { id: 'chariot', num: 7, roman: 'VII', name: 'Chariot',
      draw: () =>
        R('M50 4 L78 36 L58 36 L58 46 L42 46 L42 36 L22 36 Z') +
        ring(50, 72, 20) + L(spokes(50, 72, 0, 20, 4, 0)) + C(50, 72, 5, 'e-r') },

    { id: 'strength', num: 8, roman: 'VIII', name: 'Strength',
      draw: () =>
        F('M14 14 L28 8 L40 86 L26 92 Z') + R('M38 10 L52 6 L64 88 L50 92 Z') + F('M62 12 L76 8 L88 84 L74 90 Z') },

    { id: 'hermit', num: 9, roman: 'IX', name: 'Hermit',
      draw: () =>
        L('M40 20 C40 4 60 4 60 20') +
        F('M38 24 L62 24 L70 76 L30 76 Z') + R('M26 76 L74 76 L74 90 L26 90 Z') +
        R('M50 66 C38 56 46 46 50 36 C54 46 62 56 50 66 Z') },

    { id: 'fortune', num: 10, roman: 'X', name: 'Fortune',
      draw: () =>
        ring(50, 50, 38) + ring(50, 50, 14) + L(spokes(50, 50, 14, 38, 8, 0)) + C(50, 50, 7, 'e-r') },

    { id: 'justice', num: 11, roman: 'XI', name: 'Justice',
      draw: () =>
        L('M50 10 L50 86') + L('M18 28 L82 28') + L('M30 90 L70 90') +
        R('M18 30 L6 60 L30 60 Z') + R('M82 30 L70 60 L94 60 Z') + C(50, 14, 6, 'e-r') },

    { id: 'hanged', num: 12, roman: 'XII', name: 'Hanged',
      draw: () => L('M50 4 L50 34') + F('M20 34 L80 34 L50 92 Z') + C(50, 56, 8, 'e-r') },

    { id: 'death', num: 13, roman: 'XIII', name: 'Death',
      draw: () =>
        F('M50 8 C22 8 14 30 18 50 C20 58 28 62 30 68 L30 86 L70 86 L70 68 C72 62 80 58 82 50 C86 30 78 8 50 8 Z') +
        K('M24 44 L44 50 L40 62 L26 58 Z') + K('M76 44 L56 50 L60 62 L74 58 Z') +
        K('M50 58 L44 70 L56 70 Z') +
        `<path class="e-t" d="M40 86 L40 76 M50 86 L50 76 M60 86 L60 76"/>` },

    { id: 'temperance', num: 14, roman: 'XIV', name: 'Temperance',
      draw: () =>
        F('M8 12 L44 12 L38 44 L14 44 Z') + R('M56 56 L92 56 L86 88 L62 88 Z') +
        L('M30 44 C34 64 66 40 70 56') },

    { id: 'devil', num: 15, roman: 'XV', name: 'Devil',
      draw: () =>
        F('M18 8 C18 36 26 44 38 48 L40 34 C30 32 22 26 18 8 Z') +
        F('M82 8 C82 36 74 44 62 48 L60 34 C70 32 78 26 82 8 Z') +
        F('M28 44 L72 44 L64 82 L50 94 L36 82 Z') +
        K('M34 56 L48 62 L34 68 Z') + K('M66 56 L52 62 L66 68 Z') + R('M42 76 L58 76 L50 86 Z') },

    { id: 'tower', num: 16, roman: 'XVI', name: 'Tower',
      draw: () =>
        F('M30 92 L36 36 L64 36 L70 92 Z') +
        R('M32 36 L32 18 L42 18 L42 26 L48 26 L48 18 L52 18 L52 26 L58 26 L58 18 L68 18 L68 36 Z') +
        R('M86 4 L62 46 L74 46 L56 88 L94 38 L80 38 L96 4 Z') },

    { id: 'star', num: 17, roman: 'XVII', name: 'Star',
      draw: () => F(star(8, 46, 17)) + C(50, 50, 7, 'e-r') },

    { id: 'moon', num: 18, roman: 'XVIII', name: 'Moon',
      draw: () =>
        F('M62 8 A36 36 0 0 0 62 76 A90 90 0 0 1 62 8 Z') +
        L('M8 88 Q20 78 32 88 T56 88 T80 88 T94 88') + C(78, 30, 8, 'e-r') },

    { id: 'sun', num: 19, roman: 'XIX', name: 'Sun',
      draw: () => {
        let rays = '';
        for (let i = 0; i < 12; i++) {
          const a = i * 30;
          rays += poly([pt(50, 50, a, 47), pt(50, 50, a - 9, 29), pt(50, 50, a + 9, 29)]) + ' ';
        }
        return R(rays.trim()) + C(50, 50, 20) + C(50, 50, 8, 'e-r');
      } },

    { id: 'judgement', num: 20, roman: 'XX', name: 'Judgement',
      draw: () =>
        R('M6 42 L56 18 L56 82 L6 58 Z') + F('M2 42 L14 42 L14 58 L2 58 Z') +
        L('M68 38 Q78 50 68 62') + L('M76 26 Q92 50 76 74') },

    { id: 'world', num: 21, roman: 'XXI', name: 'World',
      draw: () => {
        let g = '';
        for (let i = 0; i < 8; i++) {
          const p = pt(50, 50, i * 45 - 90, 36);
          g += R(`M${n1(p[0])} ${n1(p[1] - 7)} L${n1(p[0] + 5)} ${n1(p[1])} L${n1(p[0])} ${n1(p[1] + 7)} L${n1(p[0] - 5)} ${n1(p[1])} Z`);
        }
        return ring(50, 50, 36) + g + F('M50 36 L64 50 L50 64 L36 50 Z');
      } }
  ];

  window.ARCANA = ARCANA;
})();
