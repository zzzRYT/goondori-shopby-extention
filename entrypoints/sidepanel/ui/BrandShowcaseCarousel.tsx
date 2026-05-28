import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrandEnv, SlotAssignment } from '../../../lib/shopby/brand-extra-info';
import { BrandShowcaseCard } from './BrandShowcaseCard';

type BrandShowcaseCarouselProps = {
  assignments: SlotAssignment[];
  env: BrandEnv;
};

const CARD_STEP = 96 + 12; // 카드 width + gap. style.css와 동기화 필요.

// 가로 스크롤 카루셀. CSS scroll-snap이 1차 동작 수단, chevron 버튼은 보조.
// chevron disabled 여부는 ResizeObserver + scroll 이벤트로 재계산한다.
export function BrandShowcaseCarousel({ assignments, env }: BrandShowcaseCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const recalc = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const overflow = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 0);
    setAtEnd(overflow <= 0 || el.scrollLeft >= overflow - 1);
  }, []);

  useEffect(() => {
    recalc();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('scroll', recalc, { passive: true });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(recalc) : null;
    observer?.observe(el);
    return () => {
      el.removeEventListener('scroll', recalc);
      observer?.disconnect();
    };
  }, [recalc, assignments.length]);

  const scrollByStep = (direction: -1 | 1) => {
    trackRef.current?.scrollBy({ left: direction * CARD_STEP, behavior: 'smooth' });
  };

  // 같은 슬롯에 여러 브랜드가 있으면 충돌 — 카드별로 conflict 플래그 계산.
  const slotCount = new Map<number, number>();
  for (const a of assignments) slotCount.set(a.slot, (slotCount.get(a.slot) ?? 0) + 1);

  return (
    <div className="brand-carousel">
      <button
        type="button"
        className="brand-carousel__chevron"
        aria-label="이전 브랜드"
        disabled={atStart}
        onClick={() => scrollByStep(-1)}
      >
        ‹
      </button>
      <div ref={trackRef} className="brand-carousel__track" role="list">
        {assignments.map((assignment, index) => (
          <BrandShowcaseCard
            key={`${assignment.slot}-${assignment.brand.brandNo}-${index}`}
            slot={assignment.slot}
            brand={assignment.brand}
            env={env}
            conflict={(slotCount.get(assignment.slot) ?? 0) > 1}
          />
        ))}
      </div>
      <button
        type="button"
        className="brand-carousel__chevron"
        aria-label="다음 브랜드"
        disabled={atEnd}
        onClick={() => scrollByStep(1)}
      >
        ›
      </button>
    </div>
  );
}
