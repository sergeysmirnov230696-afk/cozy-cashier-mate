import { Button } from "@/components/ui/button";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "←"] as const;

/** Мини-клавиатура для ввода суммы: цифры, очистка (C) и удаление последней цифры (←). */
export function NumPad({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  function press(k: string) {
    if (k === "C") {
      onChange(0);
      return;
    }
    if (k === "←") {
      onChange(Math.floor(value / 10));
      return;
    }
    onChange(Number(`${value}${k}`) || 0);
  }

  return (
    <div
      role="group"
      aria-label="Цифровая клавиатура"
      className={`grid grid-cols-3 gap-2 ${className ?? ""}`}
    >
      {KEYS.map((k) => (
        <Button
          key={k}
          type="button"
          variant={k === "C" ? "ghost" : "secondary"}
          className={`h-12 text-lg font-semibold tnum ${k === "C" ? "text-destructive" : ""}`}
          onClick={() => press(k)}
        >
          {k}
        </Button>
      ))}
    </div>
  );
}
