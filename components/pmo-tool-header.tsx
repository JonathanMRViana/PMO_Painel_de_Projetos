import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

type PmoToolHeaderProps = {
  title: string;
  subtitle: string;
  backHref?: string;
  children?: ReactNode;
};

export function PmoToolHeader({ title, subtitle, backHref, children }: PmoToolHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="h-3 bg-[#303030]" />
      <div className="mx-auto flex min-h-[68px] max-w-[1680px] items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-4">
          {backHref && (
            <a href={backHref} aria-label="Voltar ao Cockpit" className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#103f85]">
              <ArrowLeft size={21} strokeWidth={2} />
            </a>
          )}
          <img src="/makro-logo.png" alt="Makro Engenharia" className="h-8 w-auto shrink-0 object-contain sm:h-9" />
          <div className="hidden h-9 w-px shrink-0 bg-slate-200 sm:block" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight text-slate-800">{title}</p>
            <p className="mt-0.5 truncate text-xs leading-tight text-[#315783]">{subtitle}</p>
          </div>
        </div>
        {children && <div className="flex shrink-0 items-center">{children}</div>}
      </div>
    </header>
  );
}
