import { useCallback, useRef, useState } from 'react';

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function UploadZone({ onFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        return;
      }
      onFile(file);
    },
    [onFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      handleFiles(e.dataTransfer.files);
    },
    [disabled, handleFiles]
  );

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
        dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 bg-white'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <p className="text-gray-700">
        <span className="font-medium">Haz clic para seleccionar</span> o arrastra el PDF aquí
      </p>
      <p className="text-sm text-gray-500 mt-1">Cuadrante semanal SISQUAL en PDF</p>
    </div>
  );
}
