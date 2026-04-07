import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { X, ChevronRight, ChevronLeft, HelpCircle, Plus, Layout, MessageSquare, Calendar } from 'lucide-react';

interface TutorialStep {
  title: string;
  description: string;
  targetId?: string;
  icon: React.ReactNode;
}

interface TutorialProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const Tutorial: React.FC<TutorialProps> = ({ isOpen, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: TutorialStep[] = [
    {
      title: "¡Bienvenido a la plataforma!",
      description: "Te ayudamos a conectar con los mejores profesionales para tus necesidades. Esta guía rápida te mostrará cómo empezar.",
      icon: <Layout className="w-8 h-8 text-primary" />
    },
    {
      title: "Tus Pedidos",
      description: "En esta pantalla verás todos los trabajos que has publicado. Puedes ver su estado y las propuestas que recibas.",
      targetId: "main-content",
      icon: <Layout className="w-8 h-8 text-primary" />
    },
    {
      title: "Publicar un Trabajo",
      description: "Haz clic en 'Nuevo Trabajo' para empezar. Deberás elegir una categoría, poner un título claro y describir lo que necesitas.",
      targetId: "new-job-button",
      icon: <Plus className="w-8 h-8 text-primary" />
    },
    {
      title: "¿Qué pasa después?",
      description: "Una vez publicado, los profesionales te enviarán presupuestos. Podrás chatear con ellos para ajustar detalles y acordar un precio.",
      icon: <MessageSquare className="w-8 h-8 text-primary" />
    },
    {
      title: "Agenda y Encuentros",
      description: "Cuando aceptes un presupuesto, podrás proponer un horario de encuentro. Todo quedará registrado en tu Agenda.",
      icon: <Calendar className="w-8 h-8 text-primary" />
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden border border-stone-100"
      >
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-[2rem] flex items-center justify-center">
              {steps[currentStep].icon}
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-stone-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-stone-400" />
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h3 className="text-2xl font-black text-stone-900 leading-tight">
                {steps[currentStep].title}
              </h3>
              <p className="text-stone-500 font-medium leading-relaxed">
                {steps[currentStep].description}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-10 flex items-center justify-between">
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <div 
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentStep ? 'w-6 bg-primary' : 'w-1.5 bg-stone-200'
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-3">
              {currentStep > 0 && (
                <Button 
                  variant="ghost" 
                  onClick={handleBack}
                  className="p-3 rounded-2xl"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              )}
              <Button 
                onClick={handleNext}
                className="px-6 py-3 rounded-2xl flex items-center gap-2 font-black uppercase tracking-widest text-[10px]"
              >
                {currentStep === steps.length - 1 ? '¡Entendido!' : 'Siguiente'}
                {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
