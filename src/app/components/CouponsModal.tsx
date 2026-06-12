import { useState } from 'react';
import { X, ChevronDown, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { COUPONS, Coupon } from '../lib/coupons';

// Isologo del cupón: usa la imagen si existe, si no un badge con la inicial.
function CouponLogo({ coupon, size = 'w-10 h-10' }: { coupon: Coupon; size?: string }) {
  if (coupon.logo) {
    return <img src={coupon.logo} alt={coupon.brand} className={`${size} rounded-xl object-cover shrink-0`} />;
  }
  return (
    <span
      className={`${size} rounded-xl flex items-center justify-center text-white font-bold shrink-0`}
      style={{ background: coupon.color }}
    >
      {coupon.brand[0]}
    </span>
  );
}

// PR — Pop-up "Mis cupones". Lista los cupones; al tocar uno se despliega el
// mensaje + el código + el link para comprar. Se abre desde el cupón del
// informe y desde el perfil.
export function CouponsModal({ onClose }: { onClose: () => void }) {
  const [openId, setOpenId] = useState<string | null>(COUPONS[0]?.id ?? null);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-[#D7C2EF]/60 px-5 py-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#7626B3]" style={{ fontFamily: 'var(--font-serif)' }}>
            Mis cupones
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-[#7626B3]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {COUPONS.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">Todavía no tenés cupones disponibles.</p>
          )}

          {COUPONS.map((c) => {
            const open = openId === c.id;
            return (
              <div
                key={c.id}
                className={`rounded-xl border transition-colors ${open ? 'border-[#7626B3] bg-[#F0E7FA]/40' : 'border-gray-200 bg-white'}`}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : c.id)}
                  className="w-full flex items-center gap-3 p-3 text-left"
                  aria-expanded={open}
                >
                  <CouponLogo coupon={c} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{c.brand}</p>
                    <p className="text-xs text-gray-500">Código {c.code}</p>
                  </div>
                  <span className="text-sm font-bold px-2.5 py-1 rounded-full text-white" style={{ background: c.color }}>
                    {c.discount} OFF
                  </span>
                  <ChevronDown className={`w-5 h-5 text-[#7626B3] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-1">
                        <p className="text-sm text-gray-700 leading-relaxed mb-3">{c.message}</p>
                        <div className="flex items-center justify-between bg-white border border-dashed border-[#7626B3] rounded-lg px-3 py-2 mb-3">
                          <span className="text-xs text-gray-500">Tu código</span>
                          <span className="text-base font-bold tracking-wider text-[#7626B3]">{c.code}</span>
                        </div>
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 bg-[#059669] hover:bg-[#047857] text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
                        >
                          Comprar en {c.brand} <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
