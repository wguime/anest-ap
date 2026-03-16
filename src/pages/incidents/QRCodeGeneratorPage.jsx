import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { QRCode, QRCodeCard } from '@/design-system/components/ui/qr-code';
import {
  Download,
  Copy,
  Check,
  Printer,
  ExternalLink,
  Info,
  ChevronLeft
} from 'lucide-react';


export default function QRCodeGeneratorPage({ onNavigate }) {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef(null);

  const baseUrl = window.location.origin;
  const formUrl = `${baseUrl}/gestao-incidentes.html`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  const handleDownload = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = 'qrcode-gestao-incidentes-anest.png';
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code - Centro de Gestão de Incidentes</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
          }
          .container {
            text-align: center;
            max-width: 400px;
          }
          h1 {
            font-size: 24px;
            margin-bottom: 8px;
            color: #111827;
          }
          p {
            font-size: 14px;
            color: #6B7280;
            margin-bottom: 24px;
          }
          img {
            width: 250px;
            height: 250px;
            margin-bottom: 24px;
          }
          .url {
            font-size: 12px;
            color: #9CA3AF;
            word-break: break-all;
          }
          .footer {
            margin-top: 24px;
            font-size: 12px;
            color: #9CA3AF;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Centro de Gestão de Incidentes</h1>
          <p>Página unificada com acesso a todos os formulários</p>
          <img src="${canvas.toDataURL('image/png')}" alt="QR Code" />
          <p class="url">${formUrl}</p>
          <p class="footer">ANEST - Sistema de Gestão de Qualidade</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('incidentes')}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            Gerador de QR Code
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      {/* Header fixo via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espaçador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">

        {/* Info banner */}
        <div className="mb-5 p-4 rounded-xl bg-[#E8F5E9] dark:bg-[#243530] border border-[#A5D6A7] dark:border-[#2D4A3E]">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-[#006837] dark:text-[#2ECC71] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#004225] dark:text-white">
                QR Code — Centro de Gestão de Incidentes
              </p>
              <p className="text-xs text-[#6B7280] dark:text-[#6B8178] mt-1">
                Imprima e afixe em locais estratégicos para permitir notificações e denúncias via formulários públicos, sem necessidade de login.
              </p>
            </div>
          </div>
        </div>

        {/* QR Code */}
        <div className="bg-white dark:bg-[#1A2F23] rounded-2xl p-6 border border-[#E5E7EB] dark:border-[#2D4A3E]">
          <div className="flex flex-col items-center">
            {/* QR Code */}
            <div
              ref={qrRef}
              className="p-4 bg-white rounded-2xl border border-[#E5E7EB] dark:border-[#2D4A3E] mb-4"
            >
              <QRCode
                value={formUrl}
                size={200}
                fgColor="#006837"
              />
            </div>

            {/* Info */}
            <div className="text-center mb-4">
              <h3 className="font-semibold text-[#111827] dark:text-white mb-1">
                Centro de Gestão de Incidentes
              </h3>
              <p className="text-sm text-[#6B7280] dark:text-[#6B8178]">
                Página unificada com acesso a todos os formulários
              </p>
            </div>

            {/* URL */}
            <div className="w-full p-3 bg-[#F3F4F6] dark:bg-[#0D1F17] rounded-xl mb-4">
              <p className="text-xs font-mono text-[#6B7280] dark:text-[#6B8178] text-center break-all">
                {formUrl}
              </p>
            </div>

            {/* Ações */}
            <div className="w-full grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-[#F3F4F6] dark:bg-[#243530] hover:bg-[#E5E7EB] dark:hover:bg-[#2D4A3E] transition-colors"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-[#006837] dark:text-[#2ECC71]" />
                ) : (
                  <Copy className="w-5 h-5 text-[#6B7280] dark:text-[#6B8178]" />
                )}
                <span className="text-xs font-medium text-[#111827] dark:text-white">
                  {copied ? 'Copiado!' : 'Copiar'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-[#F3F4F6] dark:bg-[#243530] hover:bg-[#E5E7EB] dark:hover:bg-[#2D4A3E] transition-colors"
              >
                <Download className="w-5 h-5 text-[#6B7280] dark:text-[#6B8178]" />
                <span className="text-xs font-medium text-[#111827] dark:text-white">
                  Download
                </span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-[#F3F4F6] dark:bg-[#243530] hover:bg-[#E5E7EB] dark:hover:bg-[#2D4A3E] transition-colors"
              >
                <Printer className="w-5 h-5 text-[#6B7280] dark:text-[#6B8178]" />
                <span className="text-xs font-medium text-[#111827] dark:text-white">
                  Imprimir
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Preview link */}
        <div className="mt-4">
          <a
            href={formUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#E5E7EB] dark:border-[#2D4A3E] text-[#111827] dark:text-white font-medium hover:bg-white dark:hover:bg-[#1A2F23] transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Visualizar Página
          </a>
        </div>

        {/* Dicas de uso */}
        <div className="mt-6 p-4 rounded-xl bg-[#E8F5E9] dark:bg-[#243530] border border-[#C8E6C9] dark:border-[#2A3F36]">
          <h3 className="text-sm font-semibold text-[#004225] dark:text-white mb-2">
            Dicas de Uso
          </h3>
          <ul className="space-y-2 text-xs text-[#6B7280] dark:text-[#6B8178]">
            <li className="flex items-start gap-2">
              <span className="text-[#006837] dark:text-[#2ECC71]">•</span>
              Imprima e afixe em locais estratégicos (postos de enfermagem, salas de procedimento)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#006837] dark:text-[#2ECC71]">•</span>
              O QR code direciona para o formulário público, sem necessidade de login
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#006837] dark:text-[#2ECC71]">•</span>
              As notificações são enviadas automaticamente para os responsáveis cadastrados
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
