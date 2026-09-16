import { CalendarDays } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f4f6f7] px-5 py-8 text-slate-900 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center gap-3">
          <img src="/makro-logo.png" alt="Makro Engenharia" className="h-11 w-auto object-contain" />
          <p className="border-l border-slate-200 pl-3 text-sm font-medium text-slate-500">PMO Corporativo</p>
        </header>

        <section className="mt-14">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#ed1c24]">Cockpit PMO</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Ferramentas do PMO</h1>
          <p className="mt-3 text-base text-slate-600">Acesse as ferramentas disponíveis para o acompanhamento dos projetos.</p>
        </section>

        <section className="mt-9 max-w-xl" aria-label="Ferramentas disponíveis">
          <a
            href="/postits"
            className="group flex items-center gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#8aa6d1] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#103f85]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#edf2fb] text-[#103f85]"><CalendarDays size={24} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold text-slate-800">Quadro de ações</span>
              <span className="mt-1 block text-sm leading-5 text-slate-600">Acompanhamento semanal de ações, responsáveis e prazos.</span>
            </span>
            <span aria-hidden="true" className="text-2xl text-[#ed1c24] transition-transform group-hover:translate-x-1">→</span>
          </a>
        </section>
      </div>
    </main>
  );
}
