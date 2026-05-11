import { ApiClientError, api, type DocxExportKind, type DocxExportJobStatus } from '@/lib/api';
import { toast } from 'sonner';

type DocxDownloadOptions = {
  kind: DocxExportKind;
  competitionId: number;
  filename: string;
  protocolLabel: string;
};

const DOCX_QUEUE_POLL_INTERVAL_MS = 1000;
const DOCX_QUEUE_MAX_POLLS = 90;

function statusMessage(status: DocxExportJobStatus, protocolLabel: string): string {
  if (status === 'queued') return `Черга DOCX: ${protocolLabel} в очікуванні...`;
  if (status === 'processing') return `Черга DOCX: генеруємо ${protocolLabel}...`;
  if (status === 'done') return `${protocolLabel} готовий`;
  return `Черга DOCX: помилка генерації ${protocolLabel}`;
}

export async function downloadDocxWithRetry(options: DocxDownloadOptions): Promise<void> {
  const toastId = toast.loading(`Підготовка задачі DOCX: ${options.protocolLabel}...`);
  try {
    const started = await api.submitDocxExportJob(options.kind, options.competitionId);
    let currentStatus = started.status;
    let jobId = started.jobId;
    let failReason: string | null | undefined;

    toast.loading(statusMessage(currentStatus, options.protocolLabel), { id: toastId });
    for (let poll = 0; poll < DOCX_QUEUE_MAX_POLLS && currentStatus !== 'done' && currentStatus !== 'failed'; poll++) {
      await new Promise((resolve) => setTimeout(resolve, DOCX_QUEUE_POLL_INTERVAL_MS));
      const status = await api.getDocxExportJobStatus(jobId);
      currentStatus = status.status;
      failReason = status.reason;
      toast.loading(statusMessage(currentStatus, options.protocolLabel), { id: toastId });
    }

    if (currentStatus === 'failed') {
      toast.error(`Не вдалося згенерувати ${options.protocolLabel}.`, {
        id: toastId,
        description: failReason || 'DOCX-сервіс повернув статус failed.',
        action: {
          label: 'Повторити',
          onClick: () => {
            void downloadDocxWithRetry(options);
          },
        },
      });
      return;
    }

    if (currentStatus !== 'done') {
      toast.error(`Час очікування ${options.protocolLabel} вичерпано.`, {
        id: toastId,
        action: {
          label: 'Повторити',
          onClick: () => {
            void downloadDocxWithRetry(options);
          },
        },
      });
      return;
    }

    await api.downloadDocxExportJob(jobId, options.filename);
    toast.success(`${options.protocolLabel} завантажено`, { id: toastId });
  } catch (error: unknown) {
    if (error instanceof ApiClientError && error.statusCode === 502) {
      toast.error(`Не вдалося згенерувати ${options.protocolLabel} (DOCX сервіс тимчасово недоступний).`, {
        id: toastId,
        description: error.requestId ? `Request ID: ${error.requestId}` : undefined,
        action: {
          label: 'Повторити',
          onClick: () => {
            void downloadDocxWithRetry(options);
          },
        },
      });
      return;
    }
    toast.error(error instanceof Error ? error.message : 'Помилка завантаження DOCX', { id: toastId });
  }
}
