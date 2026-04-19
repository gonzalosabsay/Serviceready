import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Wand2 } from 'lucide-react';

interface AiBudget {
  minLabor: number;
  maxLabor: number;
  avgLabor: number;
  minMaterials: number;
  maxMaterials: number;
  avgMaterials: number;
  explanation: string;
}

interface AiBudgetInvoiceProps {
  budget: AiBudget;
}

export const AiBudgetInvoice: React.FC<AiBudgetInvoiceProps> = ({ budget }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-white border-2 border-stone-100 rounded-3xl shadow-2xl overflow-hidden font-mono text-[10px] leading-tight mt-2"
    >
      <div className="bg-stone-50 px-5 py-4 border-b border-dashed border-stone-200 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="font-black uppercase tracking-[0.2em] text-primary">PRESUPUESTO IA</span>
          <span className="text-[8px] text-stone-400 mt-0.5 tracking-widest uppercase">Referencia Informativa</span>
        </div>
        <div className="text-right">
          <span className="text-stone-300 font-bold">#RESOLVE-{Math.floor(Math.random() * 100000)}</span>
        </div>
      </div>
      
      <div className="p-6 space-y-6">
        {/* Labor Section */}
        <div className="space-y-2">
          <div className="flex justify-between font-black text-stone-800 uppercase tracking-wider border-b border-stone-100 pb-1">
            <span>CONCEPTO: MANO DE OBRA</span>
            <span>ARS</span>
          </div>
          <div className="flex justify-between text-stone-400 font-bold italic">
            <span>Rango Est. Mercado</span>
            <span>${budget.minLabor?.toLocaleString()} - ${budget.maxLabor?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-primary font-black text-xs border-t border-dotted border-stone-200 pt-2 mt-1">
            <span className="flex items-center gap-1.5"><Wand2 className="w-3 h-3" /> PROMEDIO SUGERIDO</span>
            <span>${budget.avgLabor?.toLocaleString()}</span>
          </div>
        </div>

        {/* Materials Section */}
        {budget.avgMaterials > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between font-black text-stone-800 uppercase tracking-wider border-b border-stone-100 pb-1">
              <span>CONCEPTO: MATERIALES</span>
              <span>ARS</span>
            </div>
            <div className="flex justify-between text-stone-400 font-bold italic">
              <span>Rango Est. Mercado</span>
              <span>${budget.minMaterials?.toLocaleString()} - ${budget.maxMaterials?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-stone-700 font-black text-xs border-t border-dotted border-stone-200 pt-2 mt-1">
              <span>PROMEDIO SUGERIDO</span>
              <span>${budget.avgMaterials?.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Total Section */}
        <div className="pt-4 border-t-2 border-dashed border-stone-100 flex justify-between items-end">
          <div className="space-y-1.5">
            <span className="block text-stone-400 font-black uppercase text-[8px] tracking-[0.2em]">TOTAL ESTIMADO</span>
            <span className="text-3xl font-black text-stone-900 tracking-tighter leading-none">
              ${((budget.avgLabor || 0) + (budget.avgMaterials || 0)).toLocaleString()}
            </span>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-primary animate-pulse">
              <Sparkles className="w-4 h-4" />
              <span className="text-[8px] font-black uppercase tracking-widest">Optimizado</span>
            </div>
          </div>
        </div>

        <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 mt-2">
          <p className="text-stone-500 leading-relaxed italic lowercase first-letter:uppercase text-[9px] font-medium">
            "{budget.explanation}"
          </p>
        </div>
      </div>

      <div className="bg-stone-900 text-white/40 px-5 py-3 text-[7px] text-center uppercase tracking-[0.4em] font-black">
        Resolve.la • No constituye una oferta legal • Basado en IA
      </div>
    </motion.div>
  );
};
