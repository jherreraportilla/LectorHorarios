interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function EmployeeSearch({ value, onChange }: Props) {
  return (
    <div>
      <label
        htmlFor="employee-search"
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        Nombre o número de empleado
      </label>
      <input
        id="employee-search"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ej. Nuria Lima o 12345"
        autoComplete="off"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
      />
    </div>
  );
}
