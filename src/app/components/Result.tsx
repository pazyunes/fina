import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { FinancialAnalysis } from '../types';
import { g } from '../utils/gender';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { Download, Flame, TrendingUp, Target, ChevronDown, ChevronUp } from 'lucide-react';
import jsPDF from 'jspdf';
// html2canvas-pro is a drop-in fork that parses oklch/lab/lch/color-mix
// natively — required for Tailwind v4's default color palette.
import html2canvas from 'html2canvas-pro';
import './PDFStyles.css';

// Investment definitions
interface InvestmentDefinition {
  oneLiner: string;
  expanded: string;
  where: string; // Dónde se puede invertir (plataformas concretas en Argentina)
}

const INVESTMENT_DEFINITIONS: Record<string, InvestmentDefinition> = {
  'Cuenta remunerada': {
    oneLiner: 'Tu plata en la app rinde sola, todos los días.',
    expanded: 'Es como una caja de ahorro, pero tu saldo genera intereses automáticamente cada 24 horas. No tenés que hacer nada — depositás, y el dinero trabaja solo. Podés retirar cuando quieras, sin fechas fijas ni penalidades. Ideal si necesitás tener el dinero disponible en cualquier momento.',
    where: 'Mercado Pago, Ualá, Brubank, Naranja X, Personal Pay. También las cuentas remuneradas de Galicia (Move) y Santander.'
  },
  'Plazo fijo tradicional': {
    oneLiner: 'Bloqueás tu plata 30 días y te devuelven más.',
    expanded: 'Acordás con el banco guardar una suma fija por 30 días (o más). A cambio, te pagan una tasa de interés garantizada al vencimiento. El dinero no está disponible durante ese tiempo — si lo necesitás antes, perdés los intereses. Es la opción más predecible: sabés exactamente cuánto vas a recibir.',
    where: 'Homebanking de cualquier banco (Galicia, Santander, BBVA, Nación, Provincia, Macro). También desde Mercado Pago y Ualá. Comparar tasas en plazofijo.bcra.gob.ar.'
  },
  'Plazo fijo UVA': {
    oneLiner: 'Tus ahorros se ajustan a la inflación automáticamente.',
    expanded: 'Funciona igual que un plazo fijo tradicional, pero en vez de una tasa fija, tu dinero se actualiza según el índice de inflación (UVA). Si los precios suben, tu ahorro también sube en la misma proporción. Mínimo 90 días. Ideal para no perder poder adquisitivo en contextos de inflación alta.',
    where: 'Homebanking de bancos tradicionales: Galicia, Santander, BBVA, Nación, Provincia, Macro, ICBC. Buscá la opción "Plazo fijo UVA" dentro de inversiones.'
  },
  'Fondo común de inversión Money Market': {
    oneLiner: 'Un grupo de personas juntan plata y la invierten juntas.',
    expanded: 'Es un fondo donde miles de inversores aportan dinero, y un equipo profesional lo invierte en instrumentos de muy bajo riesgo (letras del Tesoro, plazos fijos, etc.). Vos comprás "cuotapartes" del fondo. Rinde más que una caja de ahorro, tenés liquidez en 24–48hs, y no necesitás saber nada de inversiones para usarlo.',
    where: 'Cocos Capital, Balanz, IOL (InvertirOnline), Bull Market Brokers, Portfolio Personal. También en las apps de Mercado Pago y Ualá (fondo automático).'
  },
  'Fondo común de inversión mixto': {
    oneLiner: 'Un grupo de personas juntan plata y la invierten juntas.',
    expanded: 'Es un fondo donde miles de inversores aportan dinero, y un equipo profesional lo invierte en instrumentos de muy bajo riesgo (letras del Tesoro, plazos fijos, etc.). Vos comprás "cuotapartes" del fondo. Rinde más que una caja de ahorro, tenés liquidez en 24–48hs, y no necesitás saber nada de inversiones para usarlo.',
    where: 'Cocos Capital, Balanz, IOL (InvertirOnline), Bull Market Brokers, Portfolio Personal. Elegí FCI con perfil "mixto" o "moderado".'
  },
  'Fondo común de inversión acciones': {
    oneLiner: 'Mayor potencial de ganancia, con más riesgo.',
    expanded: 'Similar al Money Market, pero el fondo invierte en acciones y bonos, no solo en instrumentos seguros. El rendimiento puede ser mucho mayor a largo plazo, pero también puede bajar. Recomendado solo si tu objetivo es a más de 12 meses y tolerás que el valor fluctúe mes a mes.',
    where: 'Cocos Capital, Balanz, IOL (InvertirOnline), Bull Market Brokers, Portfolio Personal. Buscá FCI de "Renta Variable" o "Acciones".'
  },
  'CEDEARs diversificados': {
    oneLiner: 'Comprás pedacitos de empresas como Apple o Amazon, en pesos.',
    expanded: 'Los CEDEARs son certificados que representan acciones de empresas extranjeras (Apple, Amazon, Google, etc.) pero se compran en Argentina con pesos. Tu inversión queda atada al precio de esas acciones Y al tipo de cambio, por lo que funcionan como cobertura contra la devaluación. Son para horizontes de más de 1 año y aceptando que el valor puede subir o bajar.',
    where: 'Cocos Capital, IOL (InvertirOnline), Balanz, Bull Market Brokers, Portfolio Personal, PPI. Buscá ETFs como SPY (S&P 500) o QQQ (Nasdaq) para diversificar.'
  },
  'Bonos CER': {
    oneLiner: 'Tus ahorros se ajustan a la inflación automáticamente.',
    expanded: 'Funciona igual que un plazo fijo tradicional, pero en vez de una tasa fija, tu dinero se actualiza según el índice de inflación (UVA). Si los precios suben, tu ahorro también sube en la misma proporción. Mínimo 90 días. Ideal para no perder poder adquisitivo en contextos de inflación alta.',
    where: 'Cocos Capital, IOL (InvertirOnline), Balanz, Bull Market Brokers, Portfolio Personal. Buscá bonos como TX26, TX28 o T2X5.'
  },
  'Bonos largos': {
    oneLiner: 'Tus ahorros se ajustan a la inflación automáticamente.',
    expanded: 'Funciona igual que un plazo fijo tradicional, pero en vez de una tasa fija, tu dinero se actualiza según el índice de inflación (UVA). Si los precios suben, tu ahorro también sube en la misma proporción. Mínimo 90 días. Ideal para no perder poder adquisitivo en contextos de inflación alta.',
    where: 'Cocos Capital, IOL (InvertirOnline), Balanz, Bull Market Brokers, Portfolio Personal. Consultá con el bróker qué bonos soberanos largos conviene al momento.'
  },
  'Billetera virtual': {
    oneLiner: 'Dejás la plata en la app y genera interés solo.',
    expanded: 'El saldo que tenés en la billetera genera rendimiento automático todos los días, sin que hagas nada. Es la opción con menos fricción: no hay que "invertir" de forma activa. La tasa es menor que otras opciones, pero el dinero está siempre disponible para gastar, transferir o retirar.',
    where: 'Mercado Pago, Ualá, Naranja X, Personal Pay, Prex. Ya tenés el rendimiento activado por default sobre tu saldo.'
  }
};

// Helper function to find matching definition
const getInvestmentDefinition = (investmentName: string): InvestmentDefinition | null => {
  // Try exact match first
  const exactMatch = INVESTMENT_DEFINITIONS[investmentName];
  if (exactMatch) return exactMatch;

  // Try partial match (case insensitive)
  const normalizedName = investmentName.toLowerCase();
  for (const [key, value] of Object.entries(INVESTMENT_DEFINITIONS)) {
    if (normalizedName.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedName)) {
      return value;
    }
  }

  // Log warning if no match found
  console.warn(`No definition found for investment: "${investmentName}"`);
  return null;
};

interface ResultProps {
  analysis: FinancialAnalysis;
}

export function Result({ analysis }: ResultProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [expandedInvestments, setExpandedInvestments] = useState<Set<number>>(new Set());

  // Función para formatear números con punto como separador de miles
  const formatNumber = (num: number) => {
    return num.toLocaleString('es-AR').replace(/,/g, '.');
  };

  const toggleInvestmentExpanded = (index: number) => {
    setExpandedInvestments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Edge case: Income is 0
  if (analysis.totalIncome === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-[#FBEAF0] flex items-center justify-center p-6">
        <div className="max-w-md mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-8 shadow-md text-center"
          >
            <h2
              className="text-3xl mb-4 text-[#D4537E]"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {analysis.userData.name}, empecemos por acá
            </h2>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed" style={{ fontFamily: 'var(--font-sans)' }}>
              Vemos que tu ingreso es $0. Para poder ayudarte, necesitamos entender tu situación. Si estás buscando trabajo o generando tu primer ingreso, ¡ese es el primer objetivo! Cuando tengas un ingreso, volvé y armamos tu plan.
            </p>
            <div className="text-6xl mb-6">💛</div>
            <p className="text-gray-600">
              FINA - Finanzas personales con empatía
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  // Edge case: Expenses exceed income (deficit)
  const hasDeficit = analysis.available < 0;
  const deficit = Math.abs(analysis.available);

  const generatePDF = async () => {
    if (!reportRef.current) return;

    setIsGeneratingPDF(true);

    try {
      await Promise.all([
        (document as any).fonts.load('400 14px "DM Sans"'),
        (document as any).fonts.load('700 14px "DM Sans"'),
        (document as any).fonts.load('400 18px "DM Serif Display"'),
      ]).catch(() => { /* ignore — fallback will apply */ });
      await document.fonts.ready;

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 12;
      const headerSpace = 10;
      const footerSpace = 10;
      const contentWidth = pageWidth - margin * 2;
      const pageContentTop = margin + headerSpace;
      const pageContentBottom = pageHeight - margin - footerSpace;
      const pageContentHeight = pageContentBottom - pageContentTop;
      const sectionSpacing = 4;

      let currentY = pageContentTop;

      const captureSection = async (element: HTMLElement): Promise<HTMLCanvasElement> => {
        return html2canvas(element, {
          scale: 3,
          useCORS: true,
          allowTaint: false,
          imageTimeout: 0,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: 900,
          onclone: (clonedDoc) => {
            const link = clonedDoc.createElement('link');
            link.rel = 'stylesheet';
            link.href =
              'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap';
            clonedDoc.head.appendChild(link);

            const style = clonedDoc.createElement('style');
            style.textContent = `
              * { animation: none !important; transition: none !important; }
              /* Kill stray decoration that html2canvas can render as ghost outlines. */
              *, *::before, *::after { outline: 0 !important; }
            `;
            clonedDoc.head.appendChild(style);

            // Tailwind v4 uses oklch() for its palette; html2canvas can't parse
            // it. Resolve every color-bearing computed style to rgb using the
            // canvas 2D fillStyle conversion, then write back as inline style.
            const probe = document.createElement('canvas').getContext('2d')!;
            const resolveColor = (val: string): string => {
              if (!val || val === 'none' || val === 'transparent') return val;
              if (!/okl|\blab\(|\blch\(|color\(/.test(val)) return val;
              try {
                probe.fillStyle = '#000';
                probe.fillStyle = val;
                return probe.fillStyle as string;
              } catch {
                return val;
              }
            };
            const colorFnRe = /(oklch|oklab|lab|lch|color)\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
            const replaceInString = (val: string): string => {
              if (!val || !/okl|\blab\(|\blch\(|color\(/.test(val)) return val;
              return val.replace(colorFnRe, (m) => resolveColor(m));
            };
            const colorProps: [string, string][] = [
              ['color', 'color'],
              ['backgroundColor', 'background-color'],
              ['borderTopColor', 'border-top-color'],
              ['borderRightColor', 'border-right-color'],
              ['borderBottomColor', 'border-bottom-color'],
              ['borderLeftColor', 'border-left-color'],
              ['outlineColor', 'outline-color'],
              ['textDecorationColor', 'text-decoration-color'],
              ['fill', 'fill'],
              ['stroke', 'stroke'],
            ];
            clonedDoc.querySelectorAll<HTMLElement>('*').forEach((el) => {
              const cs = getComputedStyle(el);
              colorProps.forEach(([js, css]) => {
                const v = cs.getPropertyValue(css);
                const r = resolveColor(v);
                if (r && r !== v) (el.style as any)[js] = r;
              });
              const bgi = cs.backgroundImage;
              if (bgi && bgi !== 'none') {
                const r = replaceInString(bgi);
                if (r !== bgi) el.style.backgroundImage = r;
              }
              const bxs = cs.boxShadow;
              if (bxs && bxs !== 'none') {
                const r = replaceInString(bxs);
                if (r !== bxs) el.style.boxShadow = r;
              }
            });
          },
        });
      };

      const addCanvasToPDF = (canvas: HTMLCanvasElement) => {
        const imgWidth = contentWidth;
        const pxPerMm = canvas.width / imgWidth;
        const totalHeightMm = canvas.height / pxPerMm;
        const remaining = pageContentBottom - currentY;

        // Case 1: fits in remaining space on current page.
        if (totalHeightMm <= remaining) {
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, currentY, imgWidth, totalHeightMm, undefined, 'FAST');
          currentY += totalHeightMm + sectionSpacing;
          return;
        }

        // Case 2: fits in a fresh page — push to new page intact.
        if (totalHeightMm <= pageContentHeight) {
          pdf.addPage();
          currentY = pageContentTop;
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, currentY, imgWidth, totalHeightMm, undefined, 'FAST');
          currentY += totalHeightMm + sectionSpacing;
          return;
        }

        // Case 3: section taller than one page — slice across pages.
        if (currentY !== pageContentTop) {
          pdf.addPage();
          currentY = pageContentTop;
        }
        const sliceHeightPx = Math.floor(pageContentHeight * pxPerMm);
        let offsetPx = 0;
        while (offsetPx < canvas.height) {
          const thisSlicePx = Math.min(sliceHeightPx, canvas.height - offsetPx);
          const slice = document.createElement('canvas');
          slice.width = canvas.width;
          slice.height = thisSlicePx;
          const ctx = slice.getContext('2d')!;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, slice.width, slice.height);
          ctx.drawImage(canvas, 0, offsetPx, canvas.width, thisSlicePx, 0, 0, canvas.width, thisSlicePx);
          const sliceHeightMm = thisSlicePx / pxPerMm;
          pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, pageContentTop, imgWidth, sliceHeightMm, undefined, 'FAST');
          offsetPx += thisSlicePx;
          if (offsetPx < canvas.height) {
            pdf.addPage();
            currentY = pageContentTop;
          } else {
            currentY = pageContentTop + sliceHeightMm + sectionSpacing;
          }
        }
      };

      // Build an offscreen desktop-width clone so the PDF renders identically
      // regardless of the device that triggered the download. Capturing the
      // live DOM on mobile produced compressed layout, truncated text and
      // tiny charts — this container forces a fixed 900px desktop layout.
      const PDF_WIDTH = 900;
      const offscreen = document.createElement('div');
      offscreen.id = 'fina-pdf-offscreen';
      offscreen.style.cssText = [
        'position: fixed',
        'left: -10000px',
        'top: 0',
        `width: ${PDF_WIDTH}px`,
        'background: #ffffff',
        'z-index: -1',
        'pointer-events: none',
      ].join(';');

      const clone = reportRef.current.cloneNode(true) as HTMLElement;
      clone.classList.add('fina-pdf-root');
      // Kill the Tailwind max-w-3xl / mx-auto so the clone fully fills 900px.
      clone.style.cssText = [
        'width: 100%',
        'max-width: 100%',
        'margin: 0',
        'padding: 24px',
        'box-sizing: border-box',
        'background: transparent',
      ].join(';');

      const overrides = document.createElement('style');
      overrides.textContent = `
        .fina-pdf-root, .fina-pdf-root * {
          overflow: visible !important;
          text-overflow: clip !important;
          max-height: none !important;
          animation: none !important;
          transition: none !important;
        }
        .fina-pdf-root .truncate,
        .fina-pdf-root [class*="line-clamp-"],
        .fina-pdf-root .whitespace-nowrap {
          white-space: normal !important;
          -webkit-line-clamp: unset !important;
          display: block !important;
        }
        .fina-pdf-root { font-size: 14px; }

        /* Hierarchy: make titles distinctly larger than body. */
        .fina-pdf-root h2 { font-size: 30px !important; line-height: 1.2 !important; }
        .fina-pdf-root h3 { font-size: 22px !important; line-height: 1.25 !important; }
        .fina-pdf-root h4 { font-size: 18px !important; line-height: 1.3 !important; }

        /* Separation between stacked sections (direct motion.div children). */
        .fina-pdf-root > div { margin-bottom: 24px !important; }

        /* Ensure card shadows/edges show in capture. */
        .fina-pdf-root .shadow-md,
        .fina-pdf-root .shadow-lg,
        .fina-pdf-root .shadow-sm {
          box-shadow: 0 1px 4px rgba(0,0,0,0.08) !important;
        }

        /* Hide interactive-only elements in the PDF. */
        .fina-pdf-root [data-pdf-hide] { display: none !important; }
      `;
      offscreen.appendChild(overrides);
      offscreen.appendChild(clone);
      document.body.appendChild(offscreen);

      // Neutralize in-flight motion inline styles on the clone.
      clone.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
        if (el.style.opacity && el.style.opacity !== '1') el.style.opacity = '1';
        if (el.style.transform && el.style.transform !== 'none') el.style.transform = 'none';
      });

      // --- Targeted capture overrides ---
      // Force inline backgrounds/colors on elements that Tailwind paints with
      // oklch or gradients, so html2canvas captures the intended look even if
      // a modern color function fails to rasterize.

      // 0. Force-hide interactive-only elements (JS is more reliable than
      //    a CSS selector chain across ancestor-scoped stylesheets).
      clone.querySelectorAll<HTMLElement>('[data-pdf-hide]').forEach((el) => {
        el.style.display = 'none';
      });

      // 1. Savings badge (💰 rosa) — pink pill with generous padding. Force
      //    white on EVERY descendant (p, span, strong) so text reads clearly.
      clone.querySelectorAll<HTMLElement>('[data-pdf-savings-badge]').forEach((el) => {
        el.style.backgroundColor = '#D4537E';
        el.style.backgroundImage = 'none';
        el.style.color = '#ffffff';
        el.style.display = 'inline-block';
        el.style.padding = '12px 18px';
        el.style.borderRadius = '14px';
        el.style.lineHeight = '1.4';
        el.querySelectorAll<HTMLElement>('*').forEach((c) => {
          c.style.color = '#ffffff';
          c.style.margin = '0';
        });
      });

      // 1b. Deficit warning card — the from/to gradient sometimes vanishes
      //     in capture, leaving only the ⚠️ emoji on a blank background.
      //     Force a solid red background and white text on every descendant.
      clone.querySelectorAll<HTMLElement>('[data-pdf-deficit-card]').forEach((el) => {
        el.style.backgroundColor = '#C0392B';
        el.style.backgroundImage = 'none';
        el.style.color = '#ffffff';
        el.style.padding = '28px 24px';
        el.style.borderRadius = '24px';
        el.querySelectorAll<HTMLElement>('*').forEach((c) => { c.style.color = '#ffffff'; });
      });

      // 2. Goal card: more generous padding + vertical breathing room
      //    between the name, meta line, progress bar, badge and insight.
      clone.querySelectorAll<HTMLElement>('[data-pdf-goal-card]').forEach((el) => {
        el.style.padding = '24px';
        el.style.borderRadius = '20px';
        // Space every direct child block so elements don't stack tightly.
        Array.from(el.children).forEach((c) => {
          if (c instanceof HTMLElement) c.style.marginBottom = '14px';
        });
      });

      // 2b. Goal progress track + fill. Motion leaves width:0 inline if the
      //    animation hadn't completed when the user clicked Download, so we
      //    force the target width from the data attribute.
      clone.querySelectorAll<HTMLElement>('[data-pdf-goal-track]').forEach((el) => {
        el.style.backgroundColor = '#e5e7eb';
        el.style.height = '16px';
        el.style.borderRadius = '8px';
        el.style.overflow = 'hidden';
      });
      clone.querySelectorAll<HTMLElement>('[data-pdf-goal-progress]').forEach((el) => {
        el.style.backgroundColor = '#3B6D11';
        el.style.backgroundImage = 'none';
        el.style.height = '100%';
        const pct = Number(el.getAttribute('data-pdf-goal-percentage') || '0');
        el.style.width = `${Math.max(0, Math.min(100, pct))}%`;
      });

      // 3. Goal status badge
      clone.querySelectorAll<HTMLElement>('[data-pdf-goal-status]').forEach((el) => {
        const status = el.getAttribute('data-pdf-goal-status');
        el.style.backgroundColor = status === 'possible' ? '#3B6D11' : '#D85A30';
        el.style.color = '#ffffff';
        el.style.backgroundImage = 'none';
      });

      // 4. Action plan container + step circles. Force generous padding so
      //    the title has room to breathe inside the green box.
      clone.querySelectorAll<HTMLElement>('[data-pdf-action-plan]').forEach((el) => {
        el.style.backgroundColor = '#3B6D11';
        el.style.backgroundImage = 'none';
        el.style.color = '#ffffff';
        el.style.padding = '28px 24px';
        el.style.borderRadius = '24px';
        el.querySelectorAll<HTMLElement>('*').forEach((c) => {
          // Preserve the step circle's semi-transparent white; otherwise force white text.
          if (!c.hasAttribute('data-pdf-action-step-circle')) c.style.color = '#ffffff';
        });
      });
      clone.querySelectorAll<HTMLElement>('[data-pdf-action-step-circle]').forEach((el) => {
        el.style.backgroundColor = 'rgba(255,255,255,0.25)';
        el.style.color = '#ffffff';
      });

      // 5. Investment items + numbered circles
      clone.querySelectorAll<HTMLElement>('[data-pdf-investment-item]').forEach((el) => {
        el.style.backgroundColor = '#FBEAF0';
        el.style.backgroundImage = 'none';
        el.style.padding = '14px';
        el.style.borderRadius = '12px';
        el.style.marginBottom = '10px';
      });
      clone.querySelectorAll<HTMLElement>('[data-pdf-investment-circle]').forEach((el) => {
        el.style.backgroundColor = '#D4537E';
        el.style.color = '#ffffff';
        el.style.width = '24px';
        el.style.height = '24px';
        el.style.borderRadius = '50%';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.flexShrink = '0';
        el.style.fontWeight = 'bold';
      });

      // 5b. Reducible expense cards (cream box containing emoji + text + badge).
      clone.querySelectorAll<HTMLElement>('[data-pdf-reducible-expense]').forEach((el) => {
        el.style.backgroundColor = '#FFF8F0';
        el.style.backgroundImage = 'none';
        el.style.padding = '20px';
        el.style.borderRadius = '16px';
        el.style.border = '1px solid #f0e6d6';
        el.style.marginBottom = '12px';
      });

      // 6. Replace Recharts pie with a canvas-rasterized PNG embedded as
      //    <img>. Raw <svg> inserted via innerHTML sometimes fails to render
      //    in html2canvas; a PNG data URL inside an <img> always rasterizes.
      const drawPiePng = (reduciblePct: number): string => {
        const red = Math.max(0, Math.min(100, reduciblePct));
        const fijo = Math.max(0, Math.min(100, 100 - red));
        const size = 200;
        const dpr = 2;
        const cv = document.createElement('canvas');
        cv.width = size * dpr;
        cv.height = size * dpr;
        const ctx = cv.getContext('2d');
        if (!ctx) return '';
        ctx.scale(dpr, dpr);
        const cx = size / 2;
        const cy = size / 2;
        const r = (size / 2) - 8;
        const start = -Math.PI / 2;
        const redAngle = (red / 100) * Math.PI * 2;
        // Reducible slice
        if (red > 0) {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.fillStyle = '#D85A30';
          if (red >= 99.999) {
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
          } else {
            ctx.arc(cx, cy, r, start, start + redAngle);
          }
          ctx.closePath();
          ctx.fill();
        }
        // Fijo slice
        if (fijo > 0) {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.fillStyle = '#3B6D11';
          if (fijo >= 99.999) {
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
          } else {
            ctx.arc(cx, cy, r, start + redAngle, start + Math.PI * 2);
          }
          ctx.closePath();
          ctx.fill();
        }
        return cv.toDataURL('image/png');
      };
      const buildPieHtml = (reduciblePct: number): string => {
        const red = Math.max(0, Math.min(100, reduciblePct));
        const fijo = Math.max(0, Math.min(100, 100 - red));
        const src = drawPiePng(red);
        const legendItem = (color: string, text: string) => `
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="display:inline-block;width:12px;height:12px;background:${color};border-radius:2px;"></span>
            <span>${text}</span>
          </div>`;
        return `
          <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:8px 0;">
            <img src="${src}" width="200" height="200" style="display:block;width:200px;height:200px;" />
            <div style="display:flex;gap:24px;justify-content:center;font-family:'DM Sans',Arial,sans-serif;font-size:14px;">
              ${legendItem('#D85A30', `Reducible ${red.toFixed(0)}%`)}
              ${legendItem('#3B6D11', `Fijo ${fijo.toFixed(0)}%`)}
            </div>
          </div>`;
      };
      clone.querySelectorAll<HTMLElement>('[data-pdf-pie]').forEach((el) => {
        const reducible = Number(el.getAttribute('data-pdf-pie-reducible') || '0');
        el.innerHTML = buildPieHtml(reducible);
        el.style.height = 'auto';
        el.style.minHeight = '0';
        el.style.width = '100%';
        el.style.maxWidth = 'none';
        el.style.display = 'block';
      });

      // 7. Resolve CSS font variables to concrete families. html2canvas can
      //    fail to resolve `var(--font-*)` in inline styles on cloned nodes.
      clone.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
        const s = el.getAttribute('style') || '';
        if (s.includes('var(--font-serif)')) {
          el.style.fontFamily = "'DM Serif Display', Georgia, serif";
        }
        if (s.includes('var(--font-sans)')) {
          el.style.fontFamily = "'DM Sans', Arial, sans-serif";
        }
      });

      // Let the browser lay out the clone at the new width before capture.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      try {
        const sections = Array.from(clone.children).filter(
          (el) => el instanceof HTMLElement && el.tagName !== 'STYLE'
        ) as HTMLElement[];
        for (const section of sections) {
          const canvas = await captureSection(section);
          addCanvasToPDF(canvas);
        }
      } finally {
        document.body.removeChild(offscreen);
      }

      // Add headers and footers to all pages
      const totalPages = pdf.getNumberOfPages();
      const today = new Date().toLocaleDateString('es-AR');

      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);

        // Header
        pdf.setFontSize(14);
        pdf.setTextColor(212, 83, 126);
        pdf.text('FINA', margin, margin + 5);

        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text(`Generado: ${today}`, pageWidth - margin, margin + 5, { align: 'right' });

        // Pink divider line
        pdf.setDrawColor(212, 83, 126);
        pdf.setLineWidth(0.3);
        pdf.line(margin, margin + 7, pageWidth - margin, margin + 7);

        // Footer
        pdf.setFontSize(7);
        pdf.setTextColor(128, 128, 128);
        pdf.text(
          'Este informe es orientativo y no constituye asesoramiento financiero.',
          pageWidth / 2,
          pageHeight - margin - 5,
          { align: 'center' }
        );

        pdf.setFontSize(8);
        pdf.text(
          `Página ${i} de ${totalPages}`,
          pageWidth - margin,
          pageHeight - margin,
          { align: 'right' }
        );
      }

      // Save PDF
      const cleanName = analysis.userData.name.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = cleanName ? `Informe_FINA_${cleanName}.pdf` : 'Informe_FINA.pdf';
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      alert(`Hubo un error al generar el PDF.\n\nDetalle: ${msg}`);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const totalExpenses = analysis.totalExpenses;

  // Calculate actual expense values from userData
  const monthlyEntertainment = analysis.userData.entertainmentFrequency * analysis.userData.entertainmentAmount * 4.33;
  const monthlyDelivery = analysis.userData.deliveryFrequency * analysis.userData.deliveryAmount * 4.33;
  const subscriptionsCost = analysis.userData.subscriptions.reduce((sum, sub) => sum + sub.cost, 0);
  const installmentsCost = analysis.userData.installments.reduce((sum, inst) => sum + inst.monthlyAmount, 0);

  const expenseData = [
    { name: 'Vivienda', value: analysis.userData.expenses.housing, color: '#D4537E' },
    { name: 'Salud', value: analysis.userData.expenses.health, color: '#D85A30' },
    { name: 'Transporte / movilidad', value: analysis.userData.expenses.transport, color: '#9C7AA5' },
    { name: 'Suscripciones', value: subscriptionsCost, color: '#3B6D11' },
    { name: 'Ocio', value: Math.round(monthlyEntertainment), color: '#E89AC7' },
    { name: 'Delivery', value: Math.round(monthlyDelivery), color: '#C14870' },
    { name: 'Cuotas', value: installmentsCost, color: '#8B5CF6' },
  ].filter(item => item.value > 0);

  const pieData = [
    { name: 'Reducible', value: analysis.reduciblePercentage, color: '#D85A30' },
    { name: 'Fijo', value: 100 - analysis.reduciblePercentage, color: '#3B6D11' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-[#FBEAF0]">
      {/* Header con botón de descarga */}
      <div className="sticky top-0 bg-white shadow-sm z-10 p-4">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <h1 
            className="text-2xl text-[#D4537E]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            FINA
          </h1>
          <Button
            onClick={generatePDF}
            disabled={isGeneratingPDF}
            className="bg-[#D4537E] hover:bg-[#C14870] text-white gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {isGeneratingPDF ? 'Generando...' : 'Descargar PDF'}
          </Button>
        </div>
      </div>

      {/* Contenido del reporte */}
      <div ref={reportRef} className="max-w-3xl mx-auto p-6 space-y-8">
        {/* Header personalizado */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-8 shadow-md"
        >
          <h2 
            className="text-3xl mb-4 text-[#D4537E]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Hola, {analysis.userData.name}.
          </h2>
          <p className="text-xl text-gray-700" style={{ fontFamily: 'var(--font-sans)' }}>
            Esto es lo que encontramos.
          </p>
        </motion.div>

        {/* Nivel financiero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#FBEAF0] rounded-3xl p-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-8 h-8 text-[#D4537E]" />
            <h3 
              className="text-2xl text-[#D4537E]"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              Tu nivel financiero
            </h3>
          </div>
          <p className="text-2xl" style={{ fontFamily: 'var(--font-sans)' }}>
            {analysis.financialLevel}
          </p>
        </motion.div>

        {/* Métricas principales */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-3 sm:gap-4"
          style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
        >
          <div className="bg-white rounded-2xl p-3 sm:p-6 shadow-sm min-w-0" style={{ boxSizing: 'border-box' }}>
            <p className="text-xs sm:text-sm text-gray-500 mb-1 sm:mb-2">Ingresos</p>
            <p
              className="text-[#3B6D11] break-all overflow-hidden"
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'clamp(1rem, 4vw, 1.5rem)'
              }}
            >
              ${analysis.totalIncome.toLocaleString('es-AR').replace(/,/g, '.')}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-3 sm:p-6 shadow-sm min-w-0" style={{ boxSizing: 'border-box' }}>
            <p className="text-xs sm:text-sm text-gray-500 mb-1 sm:mb-2">Egresos</p>
            <p
              className="text-[#D85A30] break-all overflow-hidden"
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'clamp(1rem, 4vw, 1.5rem)'
              }}
            >
              ${analysis.totalExpenses.toLocaleString('es-AR').replace(/,/g, '.')}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-3 sm:p-6 shadow-sm min-w-0" style={{ boxSizing: 'border-box' }}>
            <p className="text-xs sm:text-sm text-gray-500 mb-1 sm:mb-2">Disponible</p>
            <p
              className={`${analysis.available >= 0 ? 'text-[#3B6D11]' : 'text-[#D4537E]'} break-all overflow-hidden`}
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'clamp(1rem, 4vw, 1.5rem)'
              }}
            >
              ${analysis.available.toLocaleString('es-AR').replace(/,/g, '.')}
            </p>
          </div>
        </motion.div>

        {/* Deficit Warning - only show if expenses exceed income */}
        {hasDeficit && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            data-pdf-deficit-card
            className="bg-gradient-to-br from-[#D85A30] to-[#D4537E] rounded-3xl p-8 shadow-lg text-white"
          >
            <h3
              className="text-2xl mb-4"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              ⚠️ Tus gastos superan tus ingresos
            </h3>
            <p className="text-xl mb-4" style={{ fontFamily: 'var(--font-sans)' }}>
              Estás gastando <strong>${deficit.toLocaleString('es-AR').replace(/,/g, '.')}/mes</strong> más de lo que ingresa.
            </p>
            <p className="text-lg opacity-95 leading-relaxed">
              Antes de hablar de ahorro, hay que resolver este déficit. Te mostramos por dónde empezar. Revisá tus gastos variables: delivery, suscripciones, entretenimiento y salidas. Los gastos fijos como alquiler, salud y servicios básicos son intocables por ahora.
            </p>
          </motion.div>
        )}

        {/* Barras de gasto */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-3xl p-8 shadow-md"
        >
          <h3 
            className="text-2xl mb-6 text-[#D4537E]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Desglose de gastos
          </h3>
          <div className="space-y-4">
            {expenseData.map((expense, index) => {
              const percentageOfIncome = analysis.totalIncome > 0 ? (expense.value / analysis.totalIncome) * 100 : 0;
              return (
                <div key={index}>
                  <div className="flex justify-between flex-wrap gap-1 mb-2">
                    <span className="text-gray-700 text-sm sm:text-base min-w-0">{expense.name}</span>
                    <span className="font-medium text-sm sm:text-base">${expense.value.toLocaleString('es-AR').replace(/,/g, '.')} ({percentageOfIncome.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden" style={{ boxSizing: 'border-box' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(percentageOfIncome, 100)}%` }}
                      transition={{ duration: 0.8, delay: 0.5 + index * 0.1 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: expense.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Sección "Esto duele ver" - REDISEÑADA */}
        {analysis.reducibleExpenses.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <Flame className="w-8 h-8 text-[#D85A30]" />
              <h3
                className="text-2xl text-[#D4537E]"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                Esto duele ver, pero más duele no verlo
              </h3>
            </div>

            <div className="space-y-4">
              {analysis.reducibleExpenses.map((expense, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  data-pdf-reducible-expense
                  className="bg-[#FFF8F0] rounded-3xl p-6 shadow-sm border border-gray-100"
                >
                  <div className="flex items-start gap-4 flex-col sm:flex-row">
                    {/* Emoji grande a la izquierda */}
                    <div className="text-5xl flex-shrink-0">
                      {expense.emoji}
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 space-y-3 min-w-0">
                      {/* Título */}
                      <h4 className="text-xl text-gray-900 break-words" style={{ fontFamily: 'var(--font-sans)' }}>
                        {expense.category} — <span className="font-medium">${expense.currentAmount.toLocaleString('es-AR').replace(/,/g, '.')}/mes estimado</span>
                      </h4>

                      {/* Descripción con partes en bold */}
                      <p
                        className="text-gray-700 leading-relaxed break-words"
                        style={{ fontFamily: 'var(--font-sans)' }}
                        dangerouslySetInnerHTML={{
                          __html: expense.description.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        }}
                      />

                      {/* Badge final con fondo rosa */}
                      <div data-pdf-savings-badge className="bg-[#D4537E] text-white rounded-2xl px-5 py-3 inline-block">
                        <p className="text-sm break-words" style={{ fontFamily: 'var(--font-sans)' }}>
                          💰 {expense.savingsMessage}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Total ahorrable */}
            {analysis.totalSavingsPotential > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="bg-gradient-to-br from-[#D4537E] to-[#D85A30] rounded-3xl p-8 shadow-lg text-white"
              >
                <h4 className="text-xl mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
                  Si aplicás las {analysis.reducibleExpenses.length} reducciones juntas
                </h4>
                <p className="text-4xl mb-2" style={{ fontFamily: 'var(--font-sans)' }}>
                  ${analysis.totalSavingsPotential.toLocaleString('es-AR').replace(/,/g, '.')}/mes
                </p>
                <p className="text-lg opacity-90">
                  Nuevo disponible: ${(analysis.available + analysis.totalSavingsPotential).toLocaleString('es-AR').replace(/,/g, '.')}/mes
                </p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Pie Chart - Gasto reducible */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-3xl p-4 sm:p-8 shadow-md"
        >
          <h3
            className="text-2xl mb-6 text-[#D4537E]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Potencial de ahorro
          </h3>
          <div className="flex flex-col items-center">
            <div
              className="w-full max-w-[320px] sm:max-w-none"
              data-pdf-pie
              data-pdf-pie-reducible={analysis.reduciblePercentage}
            >
              <ResponsiveContainer width="100%" height={window.innerWidth < 480 ? 240 : 300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}%`}
                    outerRadius={window.innerWidth < 480 ? 60 : 100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend
                    layout={window.innerWidth < 480 ? 'vertical' : 'horizontal'}
                    verticalAlign={window.innerWidth < 480 ? 'bottom' : 'bottom'}
                    align="center"
                    wrapperStyle={{ fontSize: window.innerWidth < 480 ? '12px' : '14px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-gray-600 text-center mt-4 break-words" style={{ fontFamily: 'var(--font-sans)' }}>
              Aproximadamente el <span className="font-bold text-[#D85A30]">{analysis.reduciblePercentage}%</span> de tus gastos son reducibles con pequeños cambios de hábitos.
            </p>
          </div>
        </motion.div>

        {/* Goals Blocked by Deficit Message */}
        {hasDeficit && analysis.goalsAnalysis.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-3xl p-8 shadow-md"
          >
            <div className="flex items-center gap-3 mb-4">
              <Target className="w-8 h-8 text-gray-400" />
              <h3
                className="text-2xl text-gray-700"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                Tus objetivos están en pausa
              </h3>
            </div>
            <p className="text-gray-600 leading-relaxed" style={{ fontFamily: 'var(--font-sans)' }}>
              Primero equilibremos tus finanzas reduciendo el déficit. Una vez que tus ingresos cubran tus gastos, podremos trabajar en alcanzar tus objetivos: {analysis.goalsAnalysis.map(g => g.title).join(', ')}.
            </p>
          </motion.div>
        )}

        {/* Objetivos financieros múltiples - only show if not in deficit */}
        {!hasDeficit && analysis.goalsAnalysis.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-8 h-8 text-[#D4537E]" />
              <h3
                className="text-2xl text-[#D4537E]"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {analysis.goalsAnalysis.length === 1 ? 'Tu objetivo' : 'Tus objetivos'}
              </h3>
            </div>

            <div className="space-y-6">
              {analysis.goalsAnalysis.map((goal, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  data-pdf-goal-card
                  className="bg-white rounded-3xl p-6 shadow-md border-2 border-gray-100"
                >
                  {/* Header del objetivo */}
                  <div className="mb-4">
                    <h4
                      className="text-xl text-[#D4537E] mb-2"
                      style={{ fontFamily: 'var(--font-sans)' }}
                    >
                      {goal.title}
                    </h4>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Meta: ${goal.amount.toLocaleString('es-AR').replace(/,/g, '.')}</span>
                      <span>Plazo: {goal.timeframe} meses</span>
                    </div>
                  </div>

                  {/* Barra de progreso (SIEMPRE visible) */}
                  <div className="mb-4">
                    <div data-pdf-goal-track className="w-full bg-gray-100 rounded-full h-4 overflow-hidden mb-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${goal.progress}%` }}
                        transition={{ duration: 1, delay: 0.8 + index * 0.1 }}
                        data-pdf-goal-progress
                        data-pdf-goal-percentage={goal.progress}
                        className="h-full bg-gradient-to-r from-[#3B6D11] to-[#4a8a15] rounded-full"
                      />
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>${(goal.amount * goal.progress / 100).toLocaleString('es-AR').replace(/,/g, '.')} ahorrados</span>
                      <span>${goal.amount.toLocaleString('es-AR').replace(/,/g, '.')} meta</span>
                    </div>
                  </div>

                  {/* Estado visual */}
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      data-pdf-goal-status={goal.status}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        goal.status === 'possible'
                          ? 'bg-[#3B6D11] text-white'
                          : 'bg-[#D85A30] text-white'
                      }`}
                    >
                      {goal.status === 'possible'
                        ? '✅ Alcanzable'
                        : '⚠️ Requiere ajustes'}
                    </span>
                    <span className="text-gray-600 text-sm">
                      ${goal.monthlyRequired.toLocaleString('es-AR').replace(/,/g, '.')}/mes necesarios
                    </span>
                  </div>

                  {/* Insight automático */}
                  <div className="bg-[#FBEAF0] rounded-2xl p-4">
                    <p className="text-gray-700 leading-relaxed" style={{ fontFamily: 'var(--font-sans)' }}>
                      {goal.insight}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Inversiones sugeridas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white rounded-3xl p-8 shadow-md"
        >
          <h3 
            className="text-2xl mb-6 text-[#D4537E]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Inversiones recomendadas
          </h3>
          <div className="space-y-3">
            {analysis.recommendedInvestments.map((investment, index) => {
              const definition = getInvestmentDefinition(investment);
              const isExpanded = expandedInvestments.has(index);

              return (
                <div key={index} data-pdf-investment-item className="p-4 bg-[#FBEAF0] rounded-xl">
                  <div className="flex items-start gap-3" style={{ flexDirection: window.innerWidth < 380 ? 'column' : 'row' }}>
                    <div data-pdf-investment-circle className="w-6 h-6 rounded-full bg-[#D4537E] flex items-center justify-center text-white text-sm flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-700 font-medium break-words">{investment}</p>

                      {definition && (
                        <>
                          <p className="text-sm text-gray-500 mt-0.5 break-words">
                            {definition.oneLiner}
                          </p>

                          <button
                            onClick={() => toggleInvestmentExpanded(index)}
                            data-pdf-hide
                            className="flex items-center gap-1 text-xs text-[#D4537E] mt-1.5 hover:text-[#C14870] transition-colors"
                          >
                            ¿Qué significa esto?
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="bg-[#FBEAF0] rounded-lg p-3.5 mt-2 border border-[#D4537E]/20">
                                  <p className="text-sm text-[#72243E] leading-relaxed break-words">
                                    {definition.expanded}
                                  </p>
                                  {definition.where && (
                                    <div className="mt-3 pt-3 border-t border-[#D4537E]/20">
                                      <p className="text-xs font-semibold text-[#D4537E] mb-1">
                                        ¿Dónde se puede invertir?
                                      </p>
                                      <p className="text-sm text-[#72243E] leading-relaxed break-words">
                                        {definition.where}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Plan de acción */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          data-pdf-action-plan
          className="bg-gradient-to-br from-[#3B6D11] to-[#2d5a0d] rounded-3xl p-8 shadow-lg text-white mb-8"
        >
          <h3 
            className="text-2xl mb-6"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Tu plan de acción
          </h3>
          <p className="mb-6 text-lg opacity-90">
            Pequeños cambios, grandes resultados. Empezá por acá:
          </p>
          <div className="space-y-4">
            {analysis.actionPlan.map((step, index) => (
              <div key={index} data-pdf-action-step className="flex items-start gap-4">
                <div data-pdf-action-step-circle className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
                  <span className="text-xl font-bold">{index + 1}</span>
                </div>
                <p className="text-lg leading-relaxed pt-2 min-w-0 break-words">{step}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Footer motivacional */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="text-center py-8"
        >
          <p className="text-xl text-gray-600 mb-2" style={{ fontFamily: 'var(--font-sans)' }}>
            No estás {g(analysis.userData.gender, 'sola', 'solo')} en esto 💛
          </p>
          <p className="text-gray-500">
            FINA - Finanzas personales con empatía
          </p>
        </motion.div>
      </div>

    </div>
  );
}