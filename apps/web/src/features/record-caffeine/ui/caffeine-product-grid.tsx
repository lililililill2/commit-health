import { formatCaffeineMg, type CaffeineProduct } from '@/entities/caffeine';
import { cn } from '@/shared/lib';

interface CaffeineProductGridProps {
  products: readonly CaffeineProduct[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function CaffeineProductGrid({ products, selectedId, onSelect }: CaffeineProductGridProps) {
  return (
    <ul
      aria-label="음료 검색 결과"
      className="grid max-h-80 grid-cols-2 gap-2.5 overflow-y-auto overscroll-contain p-1 sm:max-h-[28rem] sm:grid-cols-3 lg:grid-cols-4"
    >
      {products.map((item) => (
        <li key={item.id} className="min-w-0">
          <label className="relative block h-full cursor-pointer">
            <input
              type="radio"
              name="caffeine-product"
              value={item.id}
              checked={item.id === selectedId}
              onChange={() => onSelect(item.id)}
              className="peer sr-only"
            />
            <span
              className={cn(
                'flex h-full min-w-0 flex-col gap-2 rounded-xl border border-white/15 bg-[#19191b] p-2 text-sm transition-colors hover:border-sky-300/60 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky-300 peer-disabled:cursor-default sm:p-3',
                item.id === selectedId && 'border-sky-300 bg-sky-300/10',
              )}
            >
              <span aria-hidden="true" className="block aspect-[4/3] rounded-lg bg-white/[0.07]" />
              <span className="min-h-10 leading-5 font-medium break-keep">
                {item.brand} {item.name}
              </span>
              <span className="mt-auto text-xs text-white/65">{item.servingLabel}</span>
              <span className="text-xs whitespace-nowrap tabular-nums">
                {formatCaffeineMg(item.caffeineMg)}
              </span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
