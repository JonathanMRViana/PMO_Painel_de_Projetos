import { CalendarDays, ClipboardList, FolderKanban, Truck } from 'lucide-react';

export const dynamic = 'force-static';
const publicBase = process.env.PMO_GITHUB_PAGES === '1' ? '/PMO_Painel_de_Projetos' : '';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f4f6f7] px-5 py-8 text-slate-900 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center gap-3">
          <img
            src={`${publicBase}/makro-logo.png`}
            alt="Makro Engenharia"
            className="h-11 w-auto object-contain"
          />
          <p className="border-l border-slate-200 pl-3 text-sm font-bold text-[#103f85]">
            Diretoria de Operações – Gestão de Projetos
          </p>
        </header>

        <section className="mt-14">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#ed1c24]">
            Cockpit PMO
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Visão geral
          </h1>
          <p className="mt-3 text-base text-slate-600">
            Acesse cada projeto, seu cronograma e o quadro de ações.
          </p>
        </section>

        <section
          className="mt-9 grid max-w-4xl gap-4 md:grid-cols-2"
          aria-label="Ferramentas disponíveis"
        >
          <a
            href="/postits"
            className="group flex items-center gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#8aa6d1] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#103f85]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#edf2fb] text-[#103f85]">
              <CalendarDays size={24} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold text-slate-800">
                Quadro de ações
              </span>
              <span className="mt-1 block text-sm leading-5 text-slate-600">
                Acompanhamento semanal de ações, responsáveis e prazos.
              </span>
            </span>
            <span
              aria-hidden="true"
              className="text-2xl text-[#ed1c24] transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </a>

          <a
            href="/acompanhamento"
            className="group flex items-center gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#8aa6d1] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#103f85]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#edf2fb] text-[#103f85]">
              <ClipboardList size={24} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold text-slate-800">
                Acompanhamento de projetos
              </span>
              <span className="mt-1 block text-sm leading-5 text-slate-600">
                Modelo padrão Makro para mobilização, pessoas e equipamentos.
              </span>
            </span>
            <span
              aria-hidden="true"
              className="text-2xl text-[#ed1c24] transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </a>

          <a
            href="/visao-executiva"
            className="group flex items-center gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#8aa6d1] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#103f85]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#edf2fb] text-[#103f85]">
              <Truck size={24} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold text-slate-800">
                Visão Executiva
              </span>
              <span className="mt-1 block text-sm leading-5 text-slate-600">
                OPR das frotas e marcos de mobilização por projeto.
              </span>
            </span>
            <span
              aria-hidden="true"
              className="text-2xl text-[#ed1c24] transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </a>

          <a
            href="/projetos"
            className="group flex items-center gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#8aa6d1] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#103f85]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#edf2fb] text-[#103f85]">
              <FolderKanban size={24} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold text-slate-800">
                Projetos
              </span>
              <span className="mt-1 block text-sm leading-5 text-slate-600">
                Pastas dos projetos, status, cronogramas e ações.
              </span>
            </span>
            <span
              aria-hidden="true"
              className="text-2xl text-[#ed1c24] transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </a>
        </section>
      </div>
    </main>
  );
}
