import { useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';

import { shiftSleepTime } from '@/entities/sleep';
import { cn } from '@/shared/lib';

const hours = ['', ...Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))];
const minutes = ['00', '15', '30', '45'];

// The viewport is three rows tall with a row of padding at each end.
function rowHeight(viewport: HTMLDivElement) {
  return viewport.clientHeight / 3;
}

function centeredIndex(viewport: HTMLDivElement, lastIndex: number) {
  return Math.max(0, Math.min(lastIndex, Math.round(viewport.scrollTop / rowHeight(viewport))));
}

function TimeWheel({
  label,
  unit,
  options,
  value,
  disabled = false,
  onChange,
}: {
  label: string;
  unit: string;
  options: string[];
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; y: number; top: number; moved: boolean } | null>(null);
  const ignoreClick = useRef(false);
  const index = options.indexOf(value);
  const lastIndex = options.length - 1;

  useLayoutEffect(() => {
    const element = viewport.current;
    if (element && centeredIndex(element, lastIndex) !== index)
      element.scrollTop = index * rowHeight(element);
  }, [index, lastIndex]);

  function select(element: HTMLDivElement, next: number) {
    const clamped = Math.max(0, Math.min(lastIndex, next));
    element.scrollTop = clamped * rowHeight(element);
    if (clamped !== index) onChange(options[clamped]);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const move = { ArrowUp: index + 1, ArrowDown: index - 1, Home: 0, End: lastIndex };
    if (!Object.hasOwn(move, event.key)) return;
    event.preventDefault();
    select(event.currentTarget, move[event.key as keyof typeof move]);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    ignoreClick.current = false;
    if (disabled || event.pointerType !== 'mouse' || event.button !== 0) return;
    drag.current = {
      pointerId: event.pointerId,
      y: event.clientY,
      top: event.currentTarget.scrollTop,
      moved: false,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId || !(event.buttons & 1)) return;
    const distance = event.clientY - current.y;
    if (!current.moved && Math.abs(distance) < 5) return;
    const element = event.currentTarget;
    if (!current.moved) {
      current.moved = true;
      ignoreClick.current = true;
      element.dataset.dragging = 'true';
      element.setPointerCapture(event.pointerId);
    }
    element.scrollTop = current.top - distance;
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    if (!current.moved) return;
    const element = event.currentTarget;
    const next = centeredIndex(element, lastIndex);
    select(element, next);
    delete element.dataset.dragging;
  }

  return (
    <div className="relative min-w-0 flex-1 rounded-xl border border-white/15 bg-[#17171a]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-1 top-11 h-11 rounded-lg border border-[#7db8ff]/40 bg-[#7db8ff]/10"
      />
      <div
        ref={viewport}
        role="spinbutton"
        aria-label={`${label} ${unit}`}
        aria-valuemin={options[0] === '' ? -1 : 0}
        aria-valuemax={Number(options[lastIndex])}
        aria-valuenow={value === '' ? -1 : Number(value)}
        aria-valuetext={value === '' ? '선택 안 함' : `${value}${unit}`}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onLostPointerCapture={finishDrag}
        onPointerLeave={() => {
          if (!drag.current?.moved) drag.current = null;
        }}
        onScroll={(event) => {
          if (disabled) return;
          const next = centeredIndex(event.currentTarget, lastIndex);
          if (next !== index) onChange(options[next]);
        }}
        className={cn(
          'relative h-[8.25rem] snap-y snap-mandatory rounded-xl py-11 select-none [scrollbar-width:none]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7db8ff]',
          disabled
            ? 'overflow-hidden opacity-50'
            : 'touch-pan-y cursor-grab overflow-y-auto overscroll-y-contain data-[dragging=true]:cursor-grabbing data-[dragging=true]:snap-none',
        )}
      >
        {options.map((option, i) => (
          <div
            key={option}
            aria-hidden="true"
            onClick={() => {
              if (disabled || ignoreClick.current || !viewport.current) return;
              viewport.current.focus({ preventScroll: true });
              select(viewport.current, i);
            }}
            className={cn(
              'flex h-11 snap-center items-center justify-center text-sm tabular-nums',
              i === index ? 'font-semibold text-white' : 'text-white/60',
            )}
          >
            {option ? `${option}${unit}` : '--'}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SleepTimePicker({
  label,
  date,
  value,
  onChange,
}: {
  label: string;
  date?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const hour = value.slice(0, 2),
    minute = value.slice(3) || '00';
  return (
    <fieldset className="space-y-3 rounded-lg border border-white/15 p-4">
      <legend className="px-1 text-sm">{label}</legend>
      <p className="text-sm text-white/70">{date ?? '시각을 선택하면 날짜가 표시돼요.'}</p>
      <div className="flex items-center gap-2">
        <TimeWheel
          label={label}
          unit="시"
          options={hours}
          value={hour}
          onChange={(nextHour) => onChange(nextHour ? `${nextHour}:${minute}` : '')}
        />
        <span aria-hidden="true">:</span>
        <TimeWheel
          label={label}
          unit="분"
          options={minutes}
          value={minute}
          disabled={!hour}
          onChange={(nextMinute) => onChange(`${hour}:${nextMinute}`)}
        />
      </div>
      <div className="flex justify-center gap-2">
        {[-15, 15].map((delta) => (
          <button
            key={delta}
            type="button"
            disabled={!value}
            onClick={() => onChange(shiftSleepTime(value, delta))}
            aria-label={`${label} 15분 ${delta < 0 ? '앞당기기' : '늦추기'}`}
            className="min-h-11 rounded-lg border border-white/20 px-3 text-sm hover:bg-white/10 disabled:opacity-40"
          >
            {delta < 0 ? '−' : '+'}15분
          </button>
        ))}
      </div>
    </fieldset>
  );
}
