'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Bell,
  Boxes,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  FileBarChart,
  Gauge,
  HardHat,
  LayoutDashboard,
  Menu,
  Search,
  ShieldAlert,
  Target,
  TrendingUp,
  Truck,
  Users,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Health = 'Verde' | 'Amarelo' | 'Vermelho';
type DialogView = 'notifications' | 'report' | 'decision' | null;
type PortfolioScope =
  | 'Todos os projetos'
  | 'Em execução'
  | 'Em mobilização'
  | 'Projetos críticos';

const periods = ['Agosto 2026', 'Julho 2026', 'Junho 2026'];
const portfolioScopes: PortfolioScope[] = [
  'Todos os projetos',
  'Em execução',
  'Em mobilização',
  'Projetos críticos',
];

const portfolio = [
  {
    project: 'Expansão Mina Norte',
    client: 'Mineração Aurora',
    manager: 'Carla Menezes',
    phase: 'Execução',
    health: 'Amarelo' as Health,
    progress: 68,
    end: '18 dez 2026',
    margin: 14.2,
    pending: 3,
  },
  {
    project: 'Planta de Beneficiamento',
    client: 'Serra Azul',
    manager: 'Ricardo Alves',
    phase: 'Engenharia',
    health: 'Verde' as Health,
    progress: 42,
    end: '26 mar 2027',
    margin: 17.8,
    pending: 1,
  },
  {
    project: 'Montagem Transportador CV-07',
    client: 'Vale do Sol',
    manager: 'André Lima',
    phase: 'Execução',
    health: 'Vermelho' as Health,
    progress: 81,
    end: '09 out 2026',
    margin: 8.6,
    pending: 6,
  },
  {
    project: 'Parada Geral U-03',
    client: 'Petroquímica Atlântico',
    manager: 'Marina Costa',
    phase: 'Mobilização',
    health: 'Amarelo' as Health,
    progress: 23,
    end: '14 nov 2026',
    margin: 12.4,
    pending: 4,
  },
  {
    project: 'Pátio de Estocagem Leste',
    client: 'Minas Forte',
    manager: 'Carla Menezes',
    phase: 'Planejamento',
    health: 'Verde' as Health,
    progress: 16,
    end: '22 jun 2027',
    margin: 19.1,
    pending: 0,
  },
  {
    project: 'Desmobilização Complexo Sul',
    client: 'Aço Brasil',
    manager: 'Paulo Nunes',
    phase: 'Encerramento',
    health: 'Verde' as Health,
    progress: 94,
    end: '30 set 2026',
    margin: 15.5,
    pending: 2,
  },
];

const curveData = [
  { month: 'Mar', planned: 12, actual: 10, forecast: 10 },
  { month: 'Abr', planned: 23, actual: 20, forecast: 20 },
  { month: 'Mai', planned: 36, actual: 32, forecast: 32 },
  { month: 'Jun', planned: 49, actual: 45, forecast: 45 },
  { month: 'Jul', planned: 63, actual: 57, forecast: 57 },
  { month: 'Ago', planned: 76, actual: 69, forecast: 69 },
  { month: 'Set', planned: 88, actual: null, forecast: 81 },
  { month: 'Out', planned: 96, actual: null, forecast: 91 },
  { month: 'Nov', planned: 100, actual: null, forecast: 97 },
  { month: 'Dez', planned: 100, actual: null, forecast: 100 },
];

const statusData = [
  { name: 'Verde', value: 9, color: '#2e8b69' },
  { name: 'Amarelo', value: 4, color: '#e8a923' },
  { name: 'Vermelho', value: 2, color: '#d75151' },
];
const curveConfig = {
  planned: { label: 'Planejado', color: '#8da3ad' },
  actual: { label: 'Realizado', color: '#0d5963' },
  forecast: { label: 'Previsão', color: '#e7a52d' },
} satisfies ChartConfig;
const navigation = [
  { label: 'Visão executiva', icon: LayoutDashboard, href: '#visao' },
  { label: 'Quadro semanal', icon: CalendarDays, href: '/postits' },
  { label: 'Portfólio', icon: BriefcaseBusiness, href: '#portfolio' },
  { label: 'Planejamento', icon: CalendarClock, href: '#desempenho' },
  { label: 'Financeiro', icon: CircleDollarSign, href: '#financeiro' },
  { label: 'Riscos e decisões', icon: ShieldAlert, href: '#decisoes' },
  { label: 'Mobilização', icon: HardHat, href: '#operacao' },
  { label: 'Logística', icon: Truck, href: '#operacao' },
];
const healthStyle: Record<Health, string> = {
  Verde: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Amarelo: 'border-amber-200 bg-amber-50 text-amber-700',
  Vermelho: 'border-red-200 bg-red-50 text-red-700',
};

function MetricCard({
  label,
  value,
  note,
  trend,
  icon: Icon,
  tone = 'teal',
}: {
  label: string;
  value: string;
  note: string;
  trend?: 'up' | 'down';
  icon: typeof Gauge;
  tone?: 'teal' | 'amber' | 'red' | 'blue';
}) {
  const tones = {
    teal: 'bg-teal-50 text-teal-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-sky-50 text-sky-700',
  };
  return (
    <Card className="metric-card min-w-0 border-0 shadow-sm ring-1 ring-slate-200/80">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-[1.65rem] font-semibold leading-none tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
            {trend === 'up' && (
              <ArrowUpRight className="size-3 text-emerald-600" />
            )}
            {trend === 'down' && (
              <ArrowDownRight className="size-3 text-red-600" />
            )}
            {note}
          </p>
        </div>
        <span className={`rounded-xl p-2.5 ${tones[tone]}`}>
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [boardProjects, setBoardProjects] = useState<string[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [healthFilter, setHealthFilter] = useState<'Todos' | Health>('Todos');
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState('Agosto 2026');
  const [portfolioScope, setPortfolioScope] =
    useState<PortfolioScope>('Todos os projetos');
  const [dialogView, setDialogView] = useState<DialogView>(null);
  const [selectedDecision, setSelectedDecision] = useState<{
    title: string;
    meta: string;
  } | null>(null);
  useEffect(() => {
    void fetch('/api/postit-catalog', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data: { projects?: { name: string }[] }) => setBoardProjects(data.projects?.map((item) => item.name) || []))
      .catch(() => undefined);
  }, []);
  const filteredProjects = useMemo(
    () =>
      portfolio.filter(
        (item) =>
          (healthFilter === 'Todos' || item.health === healthFilter) &&
          (portfolioScope === 'Todos os projetos' ||
            (portfolioScope === 'Em execução' && item.phase === 'Execução') ||
            (portfolioScope === 'Em mobilização' &&
              item.phase === 'Mobilização') ||
            (portfolioScope === 'Projetos críticos' &&
              item.health === 'Vermelho')) &&
          `${item.project} ${item.client} ${item.manager}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [healthFilter, portfolioScope, query],
  );

  const scrollToPortfolio = () => {
    window.setTimeout(
      () =>
        document
          .getElementById('portfolio')
          ?.scrollIntoView({ behavior: 'smooth' }),
      0,
    );
  };

  const filterByHealth = (health: Health) => {
    setHealthFilter(health);
    setPortfolioScope('Todos os projetos');
    scrollToPortfolio();
  };

  return (
    <main className="min-h-screen bg-[#f4f6f7] text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[246px] flex-col bg-[#0b2930] text-white transition-transform lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-6">
          <div className="grid size-10 place-items-center rounded-xl bg-[#f1a72d] font-black tracking-tight text-[#0b2930]">
            M
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide">MAKRO</p>
            <p className="text-[10px] uppercase tracking-[0.19em] text-white/55">
              PMO Corporativo
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto text-white hover:bg-white/10 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          >
            <X />
          </Button>
        </div>
        <nav
          className="flex-1 space-y-1 overflow-y-auto px-3 py-5"
          aria-label="Navegação principal"
        >
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
            Gestão de projetos
          </p>
          {navigation.map(({ label, icon: Icon, href }, index) => (
            <a
              key={label}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${index === 0 ? 'bg-white/12 font-medium text-white' : 'text-white/65 hover:bg-white/8 hover:text-white'}`}
            >
              <Icon className="size-[17px]" />
              {label}
            </a>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/6 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/55">Qualidade dos dados</span>
              <span className="font-semibold text-emerald-300">92%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[92%] rounded-full bg-emerald-400" />
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-white/40">
              Atualização: 31 ago, 08:45
            </p>
          </div>
        </div>
      </aside>
      {mobileOpen && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
        />
      )}
      <div className="lg:pl-[246px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-7">
          <Button
            variant="ghost"
            size="icon"
            className="mr-2 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu />
          </Button>
          <div className="hidden min-w-0 sm:block">
            <p className="text-xs font-medium text-slate-400">
              PMO / Visão executiva
            </p>
            <p className="truncate text-sm font-semibold">
              Portfólio corporativo
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <label className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') scrollToPortfolio();
                }}
                className="h-9 w-56 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/10"
                placeholder="Buscar no painel"
                aria-label="Buscar no painel"
              />
            </label>
            <Button
              variant="outline"
              size="icon"
              aria-label="Notificações"
              className="relative"
              onClick={() => setDialogView('notifications')}
            >
              <Bell />
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-red-500" />
            </Button>
            <div className="ml-1 grid size-9 place-items-center rounded-full bg-[#0d5963] text-xs font-semibold text-white">
              JV
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-[1600px] px-4 py-5 md:px-7 md:py-7">
          <section id="visao" className="scroll-mt-24">
            <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                    DADOS DEMONSTRATIVOS
                  </Badge>
                  <span className="text-xs text-slate-400">
                    Ciclo de {period.toLowerCase().replace(' ', '/')}
                  </span>
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-[1.8rem]">
                  Cockpit do Portfólio
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Visão integrada de desempenho, exposição e decisões
                  prioritárias.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium shadow-sm">
                    {portfolioScope}
                    <ChevronDown className="size-4 text-slate-400" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {portfolioScopes.map((scope) => (
                      <DropdownMenuItem
                        key={scope}
                        onClick={() => {
                          setPortfolioScope(scope);
                          setHealthFilter('Todos');
                          scrollToPortfolio();
                        }}
                      >
                        {scope}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium shadow-sm">
                    {period} <ChevronDown className="size-4 text-slate-400" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    {periods.map((item) => (
                      <DropdownMenuItem
                        key={item}
                        onClick={() => setPeriod(item)}
                      >
                        {item}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  className="bg-[#0d5963] px-4 hover:bg-[#0a4850]"
                  onClick={() => setDialogView('report')}
                >
                  <FileBarChart />
                  Relatório executivo
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
              <MetricCard
                label="Projetos ativos"
                value={String(15 + Math.max(0, boardProjects.length - 6))}
                note={boardProjects.length > 6 ? `${boardProjects.length - 6} incluído(s) no quadro semanal` : '3 em mobilização'}
                icon={BriefcaseBusiness}
              />
              <MetricCard
                label="Carteira contratada"
                value="R$ 486 mi"
                note="+8,4% no trimestre"
                trend="up"
                icon={Banknote}
                tone="blue"
              />
              <MetricCard
                label="Margem prevista"
                value="14,8%"
                note="0,9 p.p. abaixo da meta"
                trend="down"
                icon={TrendingUp}
                tone="amber"
              />
              <MetricCard
                label="Marcos no prazo"
                value="87%"
                note="5 marcos em atenção"
                icon={Target}
              />
              <MetricCard
                label="Riscos críticos"
                value="7"
                note="2 sem resposta definida"
                icon={AlertTriangle}
                tone="red"
              />
              <MetricCard
                label="Decisões pendentes"
                value="11"
                note="4 vencem nesta semana"
                icon={ClipboardCheck}
                tone="amber"
              />
            </div>
          </section>
          <section
            id="desempenho"
            className="mt-5 grid scroll-mt-24 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,.7fr)]"
          >
            <Card className="border-0 shadow-sm ring-1 ring-slate-200/80">
              <CardHeader>
                <CardTitle>Desempenho consolidado</CardTitle>
                <CardDescription>
                  Curva de avanço físico da carteira ativa
                </CardDescription>
                <CardAction>
                  <div className="flex flex-wrap justify-end gap-3 text-[11px] text-slate-500">
                    {Object.entries(curveConfig).map(([key, item]) => (
                      <span key={key} className="flex items-center gap-1.5">
                        <i
                          className="size-2 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.label}
                      </span>
                    ))}
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={curveConfig}
                  className="h-[285px] w-full aspect-auto"
                >
                  <AreaChart
                    data={curveData}
                    margin={{ left: -20, right: 10, top: 10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="actualFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="var(--color-actual)"
                          stopOpacity={0.22}
                        />
                        <stop
                          offset="95%"
                          stopColor="var(--color-actual)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="4 4" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="planned"
                      stroke="var(--color-planned)"
                      fill="transparent"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                    <Area
                      type="monotone"
                      dataKey="actual"
                      stroke="var(--color-actual)"
                      fill="url(#actualFill)"
                      strokeWidth={3}
                      connectNulls={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="forecast"
                      stroke="var(--color-forecast)"
                      fill="transparent"
                      strokeWidth={2.5}
                      strokeDasharray="7 4"
                    />
                  </AreaChart>
                </ChartContainer>
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>
                    <strong>Desvio projetado de 3 p.p.</strong> concentrado em
                    dois projetos de montagem.
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm ring-1 ring-slate-200/80">
              <CardHeader>
                <CardTitle>Saúde da carteira</CardTitle>
                <CardDescription>{15 + Math.max(0, boardProjects.length - 6)} projetos ativos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative mx-auto h-[190px] max-w-[250px]">
                  <ChartContainer
                    config={{}}
                    className="h-full w-full aspect-auto"
                  >
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={62}
                        outerRadius={82}
                        paddingAngle={3}
                        startAngle={90}
                        endAngle={-270}
                      >
                        {statusData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={entry.color}
                            stroke="transparent"
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ChartContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
                    <span className="text-3xl font-semibold tracking-tight">
                      15
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400">
                      Projetos
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {statusData.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => filterByHealth(item.name as Health)}
                      className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center transition hover:border-slate-300"
                    >
                      <span
                        className="mx-auto mb-1 block size-2 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <strong className="block text-base">{item.value}</strong>
                      <span className="text-[10px] text-slate-500">
                        {item.name}
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
          <section
            id="decisoes"
            className="mt-5 grid scroll-mt-24 gap-5 xl:grid-cols-3"
          >
            <Card className="border-0 shadow-sm ring-1 ring-slate-200/80 xl:col-span-2">
              <CardHeader>
                <CardTitle>Decisões que precisam de atenção</CardTitle>
                <CardDescription>
                  Priorizadas por impacto e prazo de resposta
                </CardDescription>
                <CardAction>
                  <Badge variant="outline">4 nesta semana</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-1">
                {[
                  {
                    title: 'Aprovar plano de recuperação do CV-07',
                    meta: 'Impacto potencial: R$ 2,8 mi · Prazo: hoje',
                    icon: AlertTriangle,
                    tone: 'bg-red-50 text-red-600',
                  },
                  {
                    title: 'Formalizar aditivo da Parada Geral U-03',
                    meta: 'Exposição: R$ 1,4 mi · Prazo: 02 set',
                    icon: CircleDollarSign,
                    tone: 'bg-amber-50 text-amber-700',
                  },
                  {
                    title: 'Liberar contratação de guindaste 500 t',
                    meta: 'Impacta marco de mobilização · Prazo: 04 set',
                    icon: HardHat,
                    tone: 'bg-sky-50 text-sky-700',
                  },
                ].map(({ title, meta, icon: Icon, tone }) => (
                  <button
                    key={title}
                    className="group flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-slate-50"
                    onClick={() => {
                      setSelectedDecision({ title, meta });
                      setDialogView('decision');
                    }}
                  >
                    <span className={`rounded-lg p-2 ${tone}`}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm font-medium">
                        {title}
                      </strong>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {meta}
                      </span>
                    </span>
                    <span className="text-lg text-slate-300 group-hover:text-slate-600">
                      ›
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>
            <Card
              id="financeiro"
              className="scroll-mt-24 border-0 shadow-sm ring-1 ring-slate-200/80"
            >
              <CardHeader>
                <CardTitle>Previsão financeira</CardTitle>
                <CardDescription>Realizado + projeção de 2026</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <div className="flex items-end justify-between">
                    <span className="text-xs text-slate-500">
                      Faturamento anual
                    </span>
                    <strong className="text-sm">R$ 318 mi</strong>
                  </div>
                  <Progress
                    value={78}
                    className="mt-2 [&_[data-slot=progress-indicator]]:bg-[#0d5963]"
                  />
                  <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
                    <span>Realizado R$ 247 mi</span>
                    <span>78%</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-end justify-between">
                    <span className="text-xs text-slate-500">
                      Medições aprovadas
                    </span>
                    <strong className="text-sm">R$ 41,6 mi</strong>
                  </div>
                  <Progress
                    value={64}
                    className="mt-2 [&_[data-slot=progress-indicator]]:bg-[#e8a923]"
                  />
                  <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
                    <span>Pendente R$ 23,4 mi</span>
                    <span>64%</span>
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Caixa previsto — setembro
                  </p>
                  <p className="mt-1 text-xl font-semibold">R$ 36,8 mi</p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700">
                    <ArrowUpRight className="size-3" />
                    6,2% acima de agosto
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>
          <section id="portfolio" className="mt-5 scroll-mt-24">
            <Card className="border-0 shadow-sm ring-1 ring-slate-200/80">
              <CardHeader className="gap-3 md:grid-cols-[1fr_auto]">
                <div>
                  <CardTitle>Portfólio prioritário</CardTitle>
                  <CardDescription>
                    Projetos com maior impacto na carteira atual
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="relative">
                    <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="h-8 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-xs outline-none focus:border-teal-500 sm:w-52"
                      placeholder="Projeto, cliente ou gerente"
                      aria-label="Filtrar projetos"
                    />
                  </label>
                  <div className="flex rounded-lg bg-slate-100 p-0.5">
                    {(['Todos', 'Verde', 'Amarelo', 'Vermelho'] as const).map(
                      (filter) => (
                        <button
                          key={filter}
                          onClick={() => setHealthFilter(filter)}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${healthFilter === filter ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                          {filter}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto px-0">
                <table className="w-full min-w-[920px] border-collapse text-left">
                  <thead>
                    <tr className="border-y border-slate-100 bg-slate-50/70 text-[10px] uppercase tracking-[0.08em] text-slate-400">
                      <th className="px-4 py-3 font-semibold">
                        Projeto / cliente
                      </th>
                      <th className="px-4 py-3 font-semibold">Gerente</th>
                      <th className="px-4 py-3 font-semibold">Fase</th>
                      <th className="px-4 py-3 font-semibold">Saúde</th>
                      <th className="px-4 py-3 font-semibold">Avanço</th>
                      <th className="px-4 py-3 font-semibold">
                        Término previsto
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Margem
                      </th>
                      <th className="px-4 py-3 text-center font-semibold">
                        Pendências
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((item) => (
                      <tr
                        key={item.project}
                        className="border-b border-slate-100 text-xs transition hover:bg-slate-50/70"
                      >
                        <td className="px-4 py-3">
                          <strong className="block text-[13px] font-medium text-slate-800">
                            {item.project}
                          </strong>
                          <span className="mt-0.5 block text-[11px] text-slate-400">
                            {item.client}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.manager}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.phase}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={healthStyle[item.health]}
                          >
                            <span className="size-1.5 rounded-full bg-current" />
                            {item.health}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-[#0d5963]"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                            <span className="tabular-nums text-slate-500">
                              {item.progress}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{item.end}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {item.margin.toFixed(1).replace('.', ',')}%
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-grid size-6 place-items-center rounded-full text-[11px] font-semibold ${item.pending > 4 ? 'bg-red-50 text-red-600' : item.pending > 2 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}
                          >
                            {item.pending}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredProjects.length === 0 && (
                  <div className="py-12 text-center text-sm text-slate-500">
                    Nenhum projeto encontrado com os filtros atuais.
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
          <section
            id="operacao"
            className="mt-5 grid scroll-mt-24 gap-5 lg:grid-cols-3"
          >
            {[
              {
                title: 'Mobilização',
                value: '91%',
                detail: '182 de 200 profissionais liberados',
                icon: Users,
                color: 'text-teal-700 bg-teal-50',
                pct: 91,
              },
              {
                title: 'Equipamentos críticos',
                value: '6',
                detail: '2 com conflito de alocação',
                icon: Boxes,
                color: 'text-amber-700 bg-amber-50',
                pct: 76,
              },
              {
                title: 'Eficiência logística',
                value: '84%',
                detail: 'Meta mensal de 88%',
                icon: Truck,
                color: 'text-sky-700 bg-sky-50',
                pct: 84,
              },
            ].map(({ title, value, detail, icon: Icon, color, pct }) => (
              <Card
                key={title}
                className="border-0 shadow-sm ring-1 ring-slate-200/80"
              >
                <CardContent className="flex items-center gap-4">
                  <span className={`rounded-xl p-3 ${color}`}>
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-500">
                        {title}
                      </p>
                      <strong className="text-lg">{value}</strong>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#0d5963]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1.5 truncate text-[11px] text-slate-400">
                      {detail}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
          <footer className="mt-7 flex flex-col gap-2 border-t border-slate-200 py-5 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>Prévia conceitual · PMO Makro Engenharia</span>
            <span>Dados fictícios para discussão do modelo de gestão</span>
          </footer>
        </div>
      </div>
      <Dialog
        open={dialogView !== null}
        onOpenChange={(open) => {
          if (!open) setDialogView(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {dialogView === 'notifications' && (
            <>
              <DialogHeader>
                <DialogTitle>Notificações do PMO</DialogTitle>
                <DialogDescription>
                  Atualizações que precisam da sua atenção.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                {[
                  [
                    'Prazo crítico',
                    'Plano de recuperação do CV-07 vence hoje.',
                  ],
                  [
                    'Medição pendente',
                    'Parada Geral U-03 aguarda aprovação há 3 dias.',
                  ],
                  [
                    'Novo risco',
                    'Conflito de equipamento identificado na Mina Norte.',
                  ],
                ].map(([title, description], index) => (
                  <div
                    key={title}
                    className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <span
                      className={`mt-1 size-2 shrink-0 rounded-full ${index === 0 ? 'bg-red-500' : 'bg-amber-500'}`}
                    />
                    <div>
                      <strong className="text-sm font-medium">{title}</strong>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Fechar
                </DialogClose>
              </DialogFooter>
            </>
          )}
          {dialogView === 'report' && (
            <>
              <DialogHeader>
                <DialogTitle>Relatório executivo — {period}</DialogTitle>
                <DialogDescription>
                  Resumo demonstrativo da carteira selecionada.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Projetos ativos', '15'],
                  ['Carteira', 'R$ 486 mi'],
                  ['Margem prevista', '14,8%'],
                  ['Marcos no prazo', '87%'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-500">{label}</p>
                    <p className="mt-1 text-lg font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                <strong>Principal atenção:</strong> desvio projetado de 3 p.p.
                no avanço físico e quatro decisões com vencimento nesta semana.
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Fechar
                </DialogClose>
                <Button onClick={() => window.print()}>
                  <FileBarChart />
                  Imprimir relatório
                </Button>
              </DialogFooter>
            </>
          )}
          {dialogView === 'decision' && selectedDecision && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedDecision.title}</DialogTitle>
                <DialogDescription>{selectedDecision.meta}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Encaminhamento recomendado
                  </p>
                  <p className="mt-1.5 text-slate-700">
                    Validar impacto, responsável e prazo antes da próxima
                    reunião executiva do portfólio.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-400">Responsável</p>
                    <p className="mt-1 font-medium">Gerente do projeto</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Situação</p>
                    <Badge className="mt-1 border-amber-200 bg-amber-50 text-amber-700">
                      Aguardando decisão
                    </Badge>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Fechar
                </DialogClose>
                <Button
                  onClick={() => {
                    setQuery(
                      selectedDecision.title.includes('CV-07')
                        ? 'CV-07'
                        : selectedDecision.title.includes('U-03')
                          ? 'U-03'
                          : '',
                    );
                    setPortfolioScope('Todos os projetos');
                    setHealthFilter('Todos');
                    setDialogView(null);
                    scrollToPortfolio();
                  }}
                >
                  Localizar projeto
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
