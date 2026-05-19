import { useEffect, useState } from 'react';

const DISMISS_KEY = 'lector-horarios:ios-install-dismissed';

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  type IosNavigator = Navigator & { standalone?: boolean };
  const nav = window.navigator as IosNavigator;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    nav.standalone === true
  );
}

export function IosInstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIosSafari() || isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="font-medium">Conserva el historial en tu iPhone</p>
          <p className="mt-1 text-amber-800">
            Para que Safari no borre tus horarios guardados, abre el botón{' '}
            <span className="font-semibold">Compartir</span> y elige{' '}
            <span className="font-semibold">«Añadir a pantalla de inicio»</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}