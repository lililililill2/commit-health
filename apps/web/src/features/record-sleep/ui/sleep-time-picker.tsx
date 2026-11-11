import { shiftSleepTime } from '@/entities/sleep';

const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const selectClass =
  'min-h-12 rounded-lg border border-white/25 bg-[#17171a] px-3 text-base focus-visible:outline-2 focus-visible:outline-[#7db8ff]';

export function SleepTimePicker({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const hour = value.slice(0, 2),
    minute = value.slice(3) || '00';
  return (
    <fieldset className="space-y-3 rounded-lg border border-white/15 p-4">
      <legend className="px-1 text-sm">{label}</legend>
      <div className="flex items-center justify-center gap-2">
        <select
          id={`${id}-hour`}
          aria-label={`${label} 시`}
          required
          value={hour}
          onChange={(event) =>
            onChange(event.target.value ? `${event.target.value}:${minute}` : '')
          }
          className={selectClass}
        >
          <option value="">--</option>
          {hours.map((option) => (
            <option key={option} value={option}>
              {option}시
            </option>
          ))}
        </select>
        <span aria-hidden="true">:</span>
        <select
          id={`${id}-minute`}
          aria-label={`${label} 분`}
          value={minute}
          disabled={!hour}
          onChange={(event) => onChange(`${hour}:${event.target.value}`)}
          className={selectClass}
        >
          {['00', '15', '30', '45'].map((option) => (
            <option key={option} value={option}>
              {option}분
            </option>
          ))}
        </select>
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
