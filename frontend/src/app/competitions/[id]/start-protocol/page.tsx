'use client';
import { Fragment, useEffect, useState, use } from 'react';
import { api } from '@/lib/api';
import type { StartProtocolPreview as StartProtocolPreviewData } from '@/lib/api';
import { downloadDocxWithRetry } from '@/lib/docx-download';
import { toStyleUa } from '@/lib/swim-style';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import Link from 'next/link';

function msToStartFormat(ms: number | null): string {
  if (ms === null || ms === undefined) return 'NT';
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${min}:${sec.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
}

export default function StartProtocolPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const compId = parseInt(id);
  const [data, setData] = useState<StartProtocolPreviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStartProtocolPreview(compId).then(setData).finally(() => setLoading(false));
  }, [compId]);

  if (loading) return <div className="text-center py-16 text-slate-400">Завантаження протоколу...</div>;
  if (!data) return <div className="text-center py-16 text-red-500">Помилка завантаження</div>;

  const comp = data.competition;
  const handleDownloadStartDocx = () => {
    void downloadDocxWithRetry({
      kind: 'start-protocol',
      competitionId: compId,
      filename: 'Стартовий_протокол.docx',
      protocolLabel: 'стартовий протокол',
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link href={`/competitions/${compId}`} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Назад до змагання">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-xl font-bold">Стартовий протокол</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDownloadStartDocx}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <FileText className="w-4 h-4" /> Word (.docx)
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">
            <Download className="w-4 h-4" /> Друк / PDF
          </button>
        </div>
      </div>

      {/* Protocol preview — styled to match Word output */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 print:border-0 print:shadow-none print:p-0"
        style={{ fontFamily: "'Times New Roman', serif", fontSize: '11pt' }}>
        
        <div className="text-center mb-4">
          <p className="font-bold text-base">{comp.name}</p>
          {comp.categories_str && <p className="font-bold text-base">{comp.categories_str}</p>}
          <p className="mt-2">{comp.date_from}{comp.date_to && comp.date_to !== comp.date_from ? ` – ${comp.date_to}` : ''}          Басейн: {comp.pool_length} м</p>
          {(comp.location || comp.venue) && <p>{comp.location} {comp.venue}</p>}
          <p className="font-bold text-base mt-4">Стартовий протокол</p>
          <p className="font-bold underline text-base mt-2">
            День проведення: {comp.date_from}
          </p>
        </div>

        {data.events.map((event, ei: number) => (
          <div key={ei} className={ei > 0 ? 'mt-6' : ''}>
            <p className="font-bold mb-2">
              {event.distance_m}м {toStyleUa(event.style)} {event.gender === 'M' ? 'Чол.' : 'Жін.'}
            </p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="px-2 py-1.5 text-center w-16">Доріжка</th>
                  <th className="px-2 py-1.5 text-left">Прізвище та Ім'я</th>
                  <th className="px-2 py-1.5 text-center">Вік. Група</th>
                  <th className="px-2 py-1.5 text-center">Рік Нар.</th>
                  <th className="px-2 py-1.5 text-center">Заяв. Рес</th>
                  <th className="px-2 py-1.5 text-left">Тренер</th>
                </tr>
              </thead>
              <tbody>
                {event.heats.map((heat) => (
                  <Fragment key={`heat-group-${heat.number}`}>
                    <tr key={`h-${heat.number}`}>
                      <td colSpan={6} className="text-center font-bold py-2">
                        Заплив № {heat.number}
                      </td>
                    </tr>
                    {heat.entries.map((entry, j: number) => (
                      <tr key={`e-${heat.number}-${j}`} className="border-b border-slate-100">
                        <td className="px-2 py-1 text-center">{entry.lane}</td>
                        <td className="px-2 py-1">{entry.full_name}</td>
                        <td className="px-2 py-1 text-center">{entry.age_group}</td>
                        <td className="px-2 py-1 text-center">{entry.birth_year}</td>
                        <td className="px-2 py-1 text-center font-mono">{msToStartFormat(entry.entry_time_ms)}</td>
                        <td className="px-2 py-1">{entry.coach}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
