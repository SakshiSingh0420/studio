
"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { getReport, RatingReport } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
    Download, 
    ChevronLeft, 
    ShieldCheck, 
    BarChart3, 
    FileText, 
    AlertCircle, 
    CheckCircle2, 
    TrendingUp, 
    TrendingDown,
    Minus,
    Globe,
    Scale,
    Layers,
    Clock
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function ReportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [report, setReport] = useState<RatingReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!params?.id) return
      try {
        const data = await getReport(params.id as string)
        setReport(data)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params?.id])

  const riskCategories = useMemo(() => {
    if (!report?.breakdown) return []
    const categories: Record<string, any[]> = {}
    report.breakdown.forEach(p => {
        if (!categories[p.category]) categories[p.category] = []
        categories[p.category].push(p)
    })
    return Object.entries(categories)
  }, [report?.breakdown])

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
  if (!report) return (
      <div className="flex flex-col items-center justify-center h-[80vh] space-y-4">
          <AlertCircle className="w-12 h-12 text-muted-foreground opacity-20" />
          <p className="font-bold text-muted-foreground">Report document not found.</p>
          <Button onClick={() => router.push('/reports')}>Return to Archive</Button>
      </div>
  )

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 print:p-0">
      <div className="flex items-center justify-between no-print">
        <Button variant="ghost" className="font-bold text-slate-500" onClick={() => router.push('/reports')}>
          <ChevronLeft className="w-4 h-4 mr-2" /> Back to Archive
        </Button>
        <Button className="bg-slate-900 font-bold shadow-lg" onClick={() => window.print()}>
          <Download className="w-4 h-4 mr-2" /> Download Official PDF
        </Button>
      </div>

      <div className="bg-white border-2 shadow-xl rounded-[2rem] overflow-hidden print:shadow-none print:border-none">
        {/* Header Section */}
        <div className="bg-slate-900 text-white p-12 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full -mr-32 -mt-32 blur-3xl" />
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary rounded-lg">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <span className="font-black text-xs uppercase tracking-[0.3em] text-primary-foreground/60">Official Credit Disclosure</span>
                    </div>
                    <h1 className="text-6xl font-black tracking-tighter">{report.countryName}</h1>
                    <div className="flex items-center gap-4 text-slate-400 font-bold">
                        <span className="flex items-center gap-2"><Globe className="w-4 h-4" /> {report.region}</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                        <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> {report.year} Cycle</span>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                    <div className="bg-white text-slate-900 px-10 py-6 rounded-[2rem] shadow-2xl flex flex-col items-center border-b-8 border-slate-200">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Assigned Rating</span>
                        <span className="text-7xl font-black tracking-tighter text-primary leading-none">{report.rating}</span>
                        <div className="mt-4 flex items-center gap-2">
                            <Badge className="bg-slate-100 text-slate-600 border-none font-black text-[10px] px-3 py-1">
                                {report.outlook} OUTLOOK
                            </Badge>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 border-t border-white/10 relative z-10">
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Analytical Framework</p>
                    <p className="font-bold text-slate-200 text-sm flex items-center gap-2"><Layers className="w-3.5 h-3.5" /> {report.modelName} (v{report.modelVersion})</p>
                </div>
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Rating Scale</p>
                    <p className="font-bold text-slate-200 text-sm flex items-center gap-2"><Scale className="w-3.5 h-3.5" /> {report.scaleName}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Reporting Entity</p>
                    <p className="font-bold text-slate-200 text-sm">SovereignRating Enterprise Platform</p>
                </div>
            </div>
        </div>

        {/* Content Body */}
        <div className="p-12 space-y-16">
            {/* Executive Summary */}
            <section className="space-y-6">
                <div className="flex items-center gap-4">
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Executive Summary</h3>
                    <div className="h-1 bg-slate-100 flex-1 rounded-full" />
                </div>
                <div className="bg-slate-50 rounded-3xl p-10 border-2 border-slate-100">
                    <p className="text-xl font-medium leading-relaxed text-slate-700 italic">
                        "{report.summary}"
                    </p>
                </div>
            </section>

            {/* Key Metrics Dashboard */}
            <section className="space-y-6">
                <div className="flex items-center gap-4">
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Key Macroeconomic Metrics</h3>
                    <div className="h-1 bg-slate-100 flex-1 rounded-full" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-white border-2 border-slate-100 rounded-2xl space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GDP Nominal</p>
                        <p className="text-2xl font-black text-slate-900">${report.metrics.gdp.toLocaleString()}B</p>
                    </div>
                    <div className="p-6 bg-white border-2 border-slate-100 rounded-2xl space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Annual Growth</p>
                        <p className="text-2xl font-black text-primary">{report.metrics.gdpGrowth.toFixed(1)}%</p>
                    </div>
                    <div className="p-6 bg-white border-2 border-slate-100 rounded-2xl space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Debt / GDP</p>
                        <p className="text-2xl font-black text-slate-900">{report.metrics.debtToGdp.toFixed(1)}%</p>
                    </div>
                    <div className="p-6 bg-white border-2 border-slate-100 rounded-2xl space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inflation Rate</p>
                        <p className="text-2xl font-black text-slate-900">{report.metrics.inflation.toFixed(1)}%</p>
                    </div>
                    <div className="p-6 bg-white border-2 border-slate-100 rounded-2xl space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fiscal Balance</p>
                        <p className="text-2xl font-black text-slate-900">{report.metrics.fiscalBalance.toFixed(1)}%</p>
                    </div>
                    <div className="p-6 bg-white border-2 border-slate-100 rounded-2xl space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">FX Reserves</p>
                        <p className="text-2xl font-black text-slate-900">${report.metrics.fxReserves.toLocaleString()}B</p>
                    </div>
                </div>
            </section>

            {/* Risk Assessment Grouping */}
            <section className="space-y-8">
                <div className="flex items-center gap-4">
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Pillar-Based Risk Assessment</h3>
                    <div className="h-1 bg-slate-100 flex-1 rounded-full" />
                </div>
                <div className="space-y-12">
                    {riskCategories.map(([category, params]) => (
                        <div key={category} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Badge className="bg-primary px-3 py-1 font-black text-[10px] uppercase tracking-[0.15em]">{category}</Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {params.map((p: any) => (
                                    <div key={p.id} className="flex items-center justify-between p-4 bg-slate-50/50 border rounded-xl hover:bg-slate-50 transition-colors">
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-bold text-slate-900">{p.name}</p>
                                            <p className="text-[10px] font-medium text-slate-500">Value: {p.actualValue.toLocaleString()}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Score</p>
                                                <span className={cn(
                                                    "text-lg font-black",
                                                    p.score >= 4 ? "text-green-600" : p.score <= 2 ? "text-red-600" : "text-amber-600"
                                                )}>{p.score} / 5</span>
                                            </div>
                                            <div className="h-8 w-1.5 rounded-full bg-slate-200 relative overflow-hidden">
                                                <div 
                                                    className={cn(
                                                        "absolute bottom-0 left-0 w-full rounded-full transition-all",
                                                        p.score >= 4 ? "bg-green-500" : p.score <= 2 ? "bg-red-500" : "bg-amber-500"
                                                    )} 
                                                    style={{ height: `${(p.score / 5) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Rating Rationale */}
            <section className="space-y-6">
                <div className="flex items-center gap-4">
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Analytical Rationale</h3>
                    <div className="h-1 bg-slate-100 flex-1 rounded-full" />
                </div>
                <div className="prose prose-slate max-w-none text-slate-700 font-medium leading-relaxed whitespace-pre-wrap p-10 border-2 border-dashed rounded-3xl bg-slate-50/50">
                    {report.rationale}
                </div>
            </section>

            {/* Governance Section */}
            <section className="space-y-6">
                <div className="flex items-center gap-4">
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Analytical Governance</h3>
                    <div className="h-1 bg-slate-100 flex-1 rounded-full" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Model Version</p>
                        <p className="font-black text-slate-900">{report.modelName} v{report.modelVersion}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Approval Status</p>
                        <div className="flex items-center gap-2">
                            {report.status === 'Approved' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />}
                            <p className="font-black text-slate-900">{report.status}</p>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Previous Rating</p>
                        <div className="flex items-center gap-2">
                            <p className="font-black text-slate-900">{report.previousRating || 'N/A'}</p>
                            {report.ratingChange === 'Upgrade' && <TrendingUp className="w-3.5 h-3.5 text-green-500" />}
                            {report.ratingChange === 'Downgrade' && <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                            {report.ratingChange === 'Stable' && <Minus className="w-3.5 h-3.5 text-slate-400" />}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Data Sources</p>
                        <p className="font-black text-slate-900">{report.dataSource}</p>
                    </div>
                </div>
            </section>

            <div className="pt-16 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <span>SOVEREIGNRATING REPORT ID: {report.id}</span>
                <span>PRODUCED BY ENTERPRISE ANALYTICAL ENGINE V2.0</span>
                <span>OFFICIAL DISCLOSURE DOCUMENT</span>
            </div>
        </div>
      </div>
    </div>
  )
}
