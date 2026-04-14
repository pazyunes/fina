import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { FinancialAnalysis } from '../types';
import { g } from '../utils/gender';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { Download, Flame, TrendingUp, Target, ChevronDown, ChevronUp } from 'lucide-react';
import jsPDF from 'jspdf';
// @ts-expect-error — no bundled types, dom-to-image-more supports modern CSS (oklch, gradients)
import domtoimage from 'dom-to-image-more';
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

      const loadImage = (src: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });

      const captureSection = async (element: HTMLElement): Promise<HTMLCanvasElement> => {
        // dom-to-image-more renders via SVG foreignObject — the browser itself
        // rasterizes, so all modern CSS (oklch, gradients, Tailwind v4) works.
        const scale = 2;
        const rect = element.getBoundingClientRect();
        const width = Math.ceil(rect.width);
        const height = Math.ceil(rect.height);

        const dataUrl: string = await domtoimage.toPng(element, {
          width: width * scale,
          height: height * scale,
          style: {
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: `${width}px`,
            height: `${height}px`,
            background: '#ffffff',
          },
          bgcolor: '#ffffff',
          cacheBust: true,
        });

        const img = await loadImage(dataUrl);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || width * scale;
        canvas.height = img.naturalHeight || height * scale;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        return canvas;
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

      const sections = Array.from(reportRef.current.children) as HTMLElement[];
      for (const section of sections) {
        const canvas = await captureSection(section);
        addCanvasToPDF(canvas);
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
      alert('Hubo un error al generar el PDF. Por favor, intentá de nuevo.');
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
                      <div className="bg-[#D4537E] text-white rounded-2xl px-5 py-3 inline-block">
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
            <div className="w-full max-w-[320px] sm:max-w-none">
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
                    <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden mb-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${goal.progress}%` }}
                        transition={{ duration: 1, delay: 0.8 + index * 0.1 }}
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
                <div key={index} className="p-4 bg-[#FBEAF0] rounded-xl">
                  <div className="flex items-start gap-3" style={{ flexDirection: window.innerWidth < 380 ? 'column' : 'row' }}>
                    <div className="w-6 h-6 rounded-full bg-[#D4537E] flex items-center justify-center text-white text-sm flex-shrink-0">
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
              <div key={index} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
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