// PR7 — Stub. La versión real se arma en el commit siguiente con el form
// completo (top-5 ranking + frequent spots) y persistencia vía
// lib/preferences.ts.
export function PreferencesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-2xl p-6 text-sm text-gray-500" onClick={(e) => e.stopPropagation()}>
        Próximamente: ranking de prioridades + lugares frecuentes.
        <button onClick={onClose} className="block mx-auto mt-4 px-4 py-1.5 text-[#D4537E] font-medium">Cerrar</button>
      </div>
    </div>
  );
}
