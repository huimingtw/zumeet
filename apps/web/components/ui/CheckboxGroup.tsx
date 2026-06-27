// ponytail: UseFormRegister<any> boundary — both form shapes share this renderer
import type { UseFormRegister } from "react-hook-form";

export function CheckboxGroup({
  label,
  items,
  register,
}: {
  label: string;
  items: readonly (readonly [string, string])[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      {items.map(([key, text]) => (
        <label
          key={key}
          className="flex cursor-pointer items-center gap-2 text-sm text-gray-700"
        >
          <input
            type="checkbox"
            {...register(key)}
            className="accent-primary-600 h-4 w-4 rounded border-gray-300"
          />
          {text}
        </label>
      ))}
    </div>
  );
}
