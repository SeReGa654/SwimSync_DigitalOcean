import React from 'react';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: number;
  steps: { title: string; subtitle: string }[];
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, steps }) => {
  return (
    <div className="flex items-center justify-between gap-4 max-w-4xl mx-auto px-4 py-8">
      {steps.map((step, idx) => {
        const stepNum = idx + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <React.Fragment key={idx}>
            <div className="flex flex-col items-center group relative cursor-default">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 border-2 ${
                  isActive
                    ? 'bg-primary-500 border-primary-400 text-white shadow-[0_0_20px_rgba(14,165,233,0.3)] scale-110'
                    : isCompleted
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                    : 'bg-white/5 border-white/10 text-slate-500'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-6 h-6" />
                ) : (
                  <span className="text-sm font-black tracking-tighter">{stepNum}</span>
                )}
              </div>
              <div className="absolute top-14 whitespace-nowrap text-center">
                 <p className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-slate-500'}`}>
                    {step.title}
                 </p>
              </div>
            </div>
            {idx < steps.length - 1 && (
              <div className="flex-1 h-0.5 bg-white/5 relative overflow-hidden rounded-full">
                <div 
                  className="absolute top-0 left-0 h-full bg-primary-500 transition-all duration-700 ease-in-out" 
                  style={{ width: isCompleted ? '100%' : '0%' }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
