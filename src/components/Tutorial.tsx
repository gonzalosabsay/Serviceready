import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { X, ChevronRight, ChevronLeft, HelpCircle, Plus, Layout, MessageSquare, Calendar, Star, CheckCircle } from 'lucide-react';

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
  role: 'client' | 'professional';
}

export const Tutorial: React.FC<TutorialProps> = ({ isOpen, onClose, onComplete, role }) => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    setCurrentStep(0);
  }, [isOpen, role]);

  const clientSteps: TutorialStep[] = [
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
      description: "Cuando aceptes un presupuesto, podrán acordar un horario de encuentro. Todo quedará registrado en tu Agenda para que no olvides ninguna cita.",
      icon: <Calendar className="w-8 h-8 text-primary" />
    },
    {
      title: "Confirmar y Calificar",
      description: "Una vez realizado el servicio, confirma la visita y califica al profesional. Esto es clave para cerrar el trámite y mejorar la reputación de la comunidad.",
      icon: <Star className="w-8 h-8 text-primary" />
    },
    {
      title: "Perfil Profesional",
      description: "Si también quieres ofrecer tus servicios, puedes cambiar a tu perfil profesional en cualquier momento usando 'Cambiar a Profesional' arriba a la derecha.",
      targetId: "role-switch-button",
      icon: <HelpCircle className="w-8 h-8 text-primary" />
    }
  ];

  const professionalSteps: TutorialStep[] = [
    {
      title: "¡Bienvenido, Profesional!",
      description: "Aquí podrás encontrar trabajos que se ajusten a tus habilidades y hacer crecer tu negocio.",
      icon: <Layout className="w-8 h-8 text-primary" />
    },
    {
      title: "Explorar Pedidos",
      description: "En la pantalla principal verás una lista de empleos solicitados cerca de ti. Revisa los detalles para ver si te interesan.",
      targetId: "jobs-list",
      icon: <Layout className="w-8 h-8 text-primary" />
    },
    {
      title: "Mapa de Trabajos",
      description: "Usa el mapa para visualizar la ubicación exacta de los pedidos y planificar mejor tus traslados.",
      targetId: "jobs-map",
      icon: <Calendar className="w-8 h-8 text-primary" />
    },
    {
      title: "Postularse a un Pedido",
      description: "Cuando encuentres un trabajo que te guste, envía tu propuesta con un presupuesto claro y un mensaje personalizado.",
      icon: <Plus className="w-8 h-8 text-primary" />
    },
    {
      title: "¿Qué pasa después?",
      description: "Si al cliente le interesa tu propuesta, te contactará por chat. Podrán acordar detalles y fijar un encuentro que verás en tu Agenda.",
      icon: <MessageSquare className="w-8 h-8 text-primary" />
    },
    {
      title: "Calendario y Organización",
      description: "Usa el nuevo calendario en tu Agenda para organizar tu semana. Selecciona un día para ver todas tus visitas programadas a la derecha.",
      icon: <Calendar className="w-8 h-8 text-primary" />
    },
    {
      title: "Confirmación y Calificación",
      description: "Al terminar un trabajo, confirma la visita y califica al cliente. Esto actualizará tu reputación y te ayudará a conseguir más trabajos.",
      icon: <CheckCircle className="w-8 h-8 text-primary" />
    }
  ];

  const steps = role === 'client' ? clientSteps : professionalSteps;

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

  if (!isOpen || !steps[currentStep]) return null;

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
