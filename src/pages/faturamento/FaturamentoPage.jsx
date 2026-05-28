/**
 * FaturamentoPage - Módulo em Construção
 */
import { Hammer, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../components';

export default function FaturamentoPage({ _onNavigate, goBack }) {
  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Faturamento" onBack={goBack} />

      <div className="px-4 sm:px-5 py-4">
        <div className="bg-warning/10 dark:bg-warning/20 border border-warning/30 dark:border-warning/40 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <div>
              <p className="font-medium text-warning">
                Módulo em Desenvolvimento
              </p>
              <p className="text-sm text-warning">
                Os dados exibidos são ilustrativos. A integração com dados reais está sendo implementada.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-5 py-4 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-warning/10 dark:bg-warning/30 flex items-center justify-center mx-auto mb-4">
            <Hammer className="w-8 h-8 text-warning" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Modulo em Construcao
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O modulo de Faturamento esta em desenvolvimento e estara disponivel em breve.
          </p>
        </div>
      </div>

    </div>
  );
}
