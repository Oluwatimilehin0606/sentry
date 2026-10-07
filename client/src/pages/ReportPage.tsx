import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { FormError } from '@/components/FormError';
import { ScanReport } from '@/components/ScanReport';
import { SendToDeveloper, SentToDeveloperLine } from '@/components/SendToDeveloper';
import { Button } from '@/components/ui/button';
import { useDomains } from '@/lib/domains';
import { usePdfDownload, useSavedReport } from '@/lib/reports';

const dateTime = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** One saved report on its own page, with "Download PDF", "Send to my developer" and "Check again". */
export function ReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const report = useSavedReport(id);
  const download = usePdfDownload();
  const sites = useDomains();
  const site = report.data ? sites.data?.find((d) => d.hostname === report.data.hostname) : undefined;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-10 sm:px-6 sm:py-12">
      <Link
        to="/reports"
        className="flex items-center gap-1.5 self-start rounded-md text-sm font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Reports
      </Link>

      {report.isPending ? (
        <div role="status" className="flex items-center gap-3 rounded-[14px] border bg-card p-6 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          Loading the report…
        </div>
      ) : report.isError ? (
        <FormError message={report.error.message} />
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="font-display text-[1.75rem] leading-tight font-bold tracking-tight [overflow-wrap:anywhere] sm:text-[2rem]">
                {report.data.hostname}
              </h1>
              <p className="text-muted-foreground">
                {/* "1 Oct 2026, 14:05" reads as "1 Oct 2026 at 14:05". */}
                Checked {dateTime.format(new Date(report.data.scannedAt)).replace(', ', ' at ')} ·{' '}
                {report.data.mode === 'full' ? 'Full check' : 'Light check'}
                {report.data.trigger === 'scheduled' ? ' (automatic)' : ''} · took{' '}
                {(report.data.durationMs / 1000).toFixed(1)}s
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
              <Button
                variant="outline"
                className="h-12 px-5"
                disabled={download.pending}
                onClick={() => download.start(report.data.id!)}
              >
                {download.pending ? (
                  <Loader2 className="size-[18px] animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="size-[18px]" aria-hidden="true" />
                )}
                {download.pending ? 'Preparing PDF…' : 'Download PDF'}
              </Button>
              <SendToDeveloper report={{ ...report.data, id: report.data.id! }} site={site} />
              <Button variant="outline" className="h-12 px-5" onClick={() => navigate('/home', { state: { check: report.data.hostname } })}>
                Check again
              </Button>
            </div>
          </div>
          <SentToDeveloperLine report={report.data} site={site} />
          {download.error && <FormError message={download.error} />}
          <ScanReport report={report.data} />
        </>
      )}
    </div>
  );
}
