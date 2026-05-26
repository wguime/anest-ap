/**
 * ExportPresencaButton - Export meeting attendance as CSV
 *
 * Generates a CSV file with columns: Nome, Cargo, Status, Justificativa
 * Uses Blob + URL.createObjectURL for client-side download.
 */
import { useCallback } from 'react';
import { Button } from '@/design-system';
import { Download } from 'lucide-react';

/**
 * @param {Object} props
 * @param {Object} props.reuniao - Meeting object with presentes, faltantes, justificativasFaltas, participantesIds
 * @param {Array<{id: string, nome: string, role: string}>} props.allUsers - Full user list for resolving names/roles
 * @param {string} [props.className]
 */
export default function ExportPresencaButton({ reuniao, allUsers, className }) {
  const handleExport = useCallback(() => {
    if (!reuniao || !reuniao.participantesIds?.length) return;

    const presentes = new Set(reuniao.presentes || []);
    const faltantes = new Set(reuniao.faltantes || []);
    const justificativas = reuniao.justificativasFaltas || {};

    // Build rows from participantesIds
    const rows = reuniao.participantesIds.map((id) => {
      const user = allUsers.find((u) => u.id === id);
      const nome = user?.nome || user?.email || id;
      const cargo = user?.role || '-';

      let status = 'Sem registro';
      if (presentes.has(id)) status = 'Presente';
      else if (faltantes.has(id)) status = 'Ausente';

      const justificativa = justificativas[id] || '';

      return { nome, cargo, status, justificativa };
    });

    // Sort alphabetically
    rows.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    // Build CSV
    const header = 'Nome,Cargo,Status,Justificativa';
    const csvRows = rows.map((r) => {
      // Escape double quotes in fields
      const escape = (val) => `"${(val || '').replace(/"/g, '""')}"`;
      return [escape(r.nome), escape(r.cargo), escape(r.status), escape(r.justificativa)].join(',');
    });

    const csvContent = [header, ...csvRows].join('\n');

    // BOM for Excel UTF-8 compatibility
    const bom = '﻿';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // Generate filename
    const dateStr = reuniao.dataReuniao
      ? new Date(reuniao.dataReuniao).toLocaleDateString('pt-BR').replace(/\//g, '-')
      : 'sem-data';
    const sanitizedTitle = (reuniao.titulo || 'reuniao')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 40);
    const fileName = `presenca_${sanitizedTitle}_${dateStr}.csv`;

    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [reuniao, allUsers]);

  const hasParticipants = reuniao?.participantesIds?.length > 0;
  const hasAttendanceData = (reuniao?.presentes?.length > 0) || (reuniao?.faltantes?.length > 0);

  if (!hasParticipants || !hasAttendanceData) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      className={className}
      aria-label="Exportar relatório de presença como CSV"
    >
      <Download size={16} className="mr-2" />
      Exportar Presença
    </Button>
  );
}
