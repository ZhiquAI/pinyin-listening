import { useEffect, useMemo, useRef, useState } from 'react';
import { layoutPinyinWriting } from '../content/pinyinWriting';

export function PinyinWriting({ pinyin, replay }: { pinyin: string; replay: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);
  const layout = useMemo(() => layoutPinyinWriting(pinyin), [pinyin]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const measure = () => setCanScroll(element.scrollWidth > element.clientWidth + 1);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [layout.width]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const paths = Array.from(svg.querySelectorAll<SVGPathElement>('.writing-stroke'));
    const pen = svg.querySelector<SVGCircleElement>('.writing-pen');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const finish = () => {
      cancelAnimationFrame(frame);
      for (const path of paths) {
        path.setAttribute('stroke-dashoffset', '0');
        path.setAttribute('visibility', 'visible');
      }
      pen?.setAttribute('visibility', 'hidden');
    };
    if (!replay || reduced.matches || !paths.length) { finish(); return; }
    // 几何量只读取一次；逐帧只更新小型 SVG 笔画和单个笔尖。
    const lengths = paths.map((path) => path.getTotalLength());
    const durations = lengths.map((length) => Math.max(220, Math.min(650, length * 7)));
    const starts: number[] = [];
    let total = 0;
    durations.forEach((duration) => { starts.push(total); total += duration + 100; });
    for (const path of paths) {
      path.setAttribute('stroke-dashoffset', '1');
      path.setAttribute('visibility', 'hidden');
    }
    let origin: number | undefined;
    const animate = (now: number) => {
      origin ??= now;
      const elapsed = now - origin;
      let active = -1;
      paths.forEach((path, index) => {
        const progress = Math.max(0, Math.min(1, (elapsed - starts[index]) / durations[index]));
        path.setAttribute('stroke-dashoffset', String(1 - progress));
        path.setAttribute('visibility', progress > 0 ? 'visible' : 'hidden');
        if (elapsed >= starts[index] && elapsed < starts[index] + durations[index]) active = index;
      });
      if (pen && active >= 0) {
        const progress = (elapsed - starts[active]) / durations[active];
        const point = paths[active].getPointAtLength(lengths[active] * progress);
        const offset = layout.strokes[active];
        pen.setAttribute('cx', String(point.x + offset.x));
        pen.setAttribute('cy', String(point.y + offset.y));
        pen.setAttribute('visibility', 'visible');
      } else pen?.setAttribute('visibility', 'hidden');
      if (elapsed < total) frame = requestAnimationFrame(animate);
      else finish();
    };
    frame = requestAnimationFrame(animate);
    const onVisibility = () => { if (document.hidden) finish(); };
    document.addEventListener('visibilitychange', onVisibility);
    reduced.addEventListener('change', finish);
    return () => {
      finish();
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', finish);
    };
  }, [layout, replay]);

  return (
    <div className="pinyin-container">
    <div ref={scrollRef} className="pinyin-scroll" onTouchStart={(event) => event.stopPropagation()}>
    <svg ref={svgRef} className="pinyin-writing" style={{ minWidth: `${layout.width * 0.48}px` }} viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={`拼音 ${pinyin}，四线三格书写示范`}>
      {Array.from({ length: layout.rows }, (_, row) => (
        <g key={row} className="writing-grid" aria-hidden="true">
          {[20, 60, 100, 140].map((y, i) => <line key={y} x1="4" x2={layout.width - 4} y1={row * 168 + y} y2={row * 168 + y} className={i === 1 || i === 2 ? 'inner-line' : ''} />)}
        </g>
      ))}
      <g className="writing-guides" fill="none" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
        {layout.strokes.map((stroke, i) => <path key={i} d={stroke.path} transform={`translate(${stroke.x} ${stroke.y})`} />)}
      </g>
      <g fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
        {layout.strokes.map((stroke, i) => <path key={i} className="writing-stroke" d={stroke.path} transform={`translate(${stroke.x} ${stroke.y})`} pathLength="1" strokeDasharray="1 1" />)}
      </g>
      <circle className="writing-pen" r="4" visibility="hidden" />
    </svg>
    </div>
    {canScroll && <span className="pinyin-scroll-hint" aria-hidden="true">左右滑动查看</span>}
    </div>
  );
}
