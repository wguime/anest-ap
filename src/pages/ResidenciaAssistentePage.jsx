/**
 * ResidenciaAssistentePage
 * Pagina do assistente IA para residencia medica (chat + RAG + trocas)
 */
import { PageHeader } from '../components';
import { ResidenciaChatProvider } from '../contexts/ResidenciaChatContext';
import ResidenciaChat from '../components/residencia/ResidenciaChat';

export default function ResidenciaAssistentePage({ onNavigate, goBack }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-4 pt-4 sm:px-5">
        <PageHeader
          title="Assistente Residência"
          subtitle="IA + Escalas + Trocas"
          onBack={goBack}
        />
      </div>

      <ResidenciaChatProvider>
        <div className="flex-1 flex flex-col min-h-0 pb-28">
          <ResidenciaChat />
        </div>
      </ResidenciaChatProvider>
    </div>
  );
}
