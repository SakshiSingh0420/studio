
"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { getRatingById, getCountries, getModels, getParameters, Rating, Country } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
    ChevronLeft, 
    ShieldCheck, 
    Clock, 
    Globe, 
    Layers, 
    AlertCircle,
    Database,
    LineChart,
    ArrowLeft,
    CheckCircle2
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function RatingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [rating, setRating] = useState<Rating | null>(null)
  const [country, setCountry] = useState<Country | null>(null)
  const [model, setModel] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!params?.id) return
      try {
        const ratingData = await getRatingById(params.id as string)
        if (!ratingData) {
            setLoading(false)
            return
        }
        setRating(ratingData)

        const [countries, models] = await Promise.all([
            getCountries(),
            getModels()
        ])

        const demoCountries = [
            { id: 'demo-in', name: "India", region: "Asia" },
            { id: 'demo-us', name: "United States", region: "North America" },
            { id: 'demo-cn', name: "China", region: "Asia" },
            { id: 'demo-de', name: "Germany", region: "Europe" },
            { id: 'demo-br', name: "Brazil", region: "South America" },
            { id: 'demo-za', name: "South Africa", region: "Africa" }
        ] as any[]

        const cFound = countries.find(c => c.id === ratingData.countryId) || demoCountries.find(c => c.id === ratingData.countryId)
        setCountry(cFound)

        const mFound = models.find(m => m.id === ratingData.modelId)
        setModel(mFound)

      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params?.id])

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
  
  if (!rating) return (
      <div className="flex flex-col items-center justify-center h-[80vh] space-y-4">
          <AlertCircle className="w-12 h-12 text-muted-foreground opacity-20" />
          <p className="font-bold text-muted-foreground">Historical analytical session not found.</p>
          <Button onClick={() => router.push('/ratings')}>Return to Archive</Button>
      </div>
  )

  const snapshot = rating.snapshot;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="font-bold text-slate-500" onClick={() => router.push('/ratings')}>
          <ChevronLeft className="w-4 h-4 mr-2" /> Back to Analytical Ledger
        </Button>
        <div className="flex gap-2">
            <Badge variant="outline" className="h-10 px-4 font-black uppercase tracking-widest text-[10px] border-2">
                Audit Trail Document
            </Badge>
        </div>
      </div>

      <div className="grid gap-8">
        {/* Header Summary */}
        <Card className="border-2 shadow-xl overflow-hidden rounded-[2rem]">
            <div className="bg-slate-900 text-white p-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full -mr-32 -mt-32 blur-3xl" />
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Badge className="bg-primary px-3 py-1 font-black text-[9px] uppercase tracking-[0.2em] border-none">VERSION {rating.version || 1}</Badge>
                            <span className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-500">Session ID: {rating.id}</span>
                        </div>
                        <h1 className="text-6xl font-black tracking-tighter">{country?.name || 'Sovereign Entity'}</h1>
                        <div className="flex items-center gap-4 text-slate-400 font-bold">
                            <span className="flex items-center gap-2"><Globe className="w-4 h-4" /> {country?.region}</span>
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                            <span className="flex items-center gap-2"><Clock className="w-4 h-4" suppressHydrationWarning /> Finalized {rating.createdAt?.toDate ? rating.createdAt.toDate().toLocaleDateString() : 'N/A'}</span>
                        </div>
                    </div>

                    <div className="bg-white text-slate-900 px-12 py-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center border-b-8 border-slate-200">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">Final Assigned Rating</span>
                        <span className="text-8xl font-black tracking-tighter text-primary leading-none">{rating.overrideRating || rating.adjustedRating || rating.initialRating}</span>
                        <div className="mt-6 flex items-center gap-2">
                            <Badge className="bg-slate-100 text-slate-600 border-none font-black text-[10px] px-4 py-1.5">
                                AGGREGATE SCORE: {rating.finalScore.toFixed(1)}%
                            </Badge>
                        </div>
                    </div>
                </div>
            </div>
        </Card>

        <div className="grid gap-8 lg:grid-cols-3">
            {/* Snapshot Metadata */}
            <div className="lg:col-span-1 space-y-8">
                <Card className="border-2 shadow-sm h-full">
                    <CardHeader className="bg-slate-50 border-b py-6">
                        <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            <Database className="w-4 h-4" /> Framework Metadata
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Analytical Model</p>
                            <p className="font-black text-slate-900 text-lg">{model?.name || 'Legacy Framework'}</p>
                            <Badge variant="outline" className="text-[9px] font-mono mt-1">v{model?.version || 1}</Badge>
                        </div>
                        <div className="pt-6 border-t border-dashed">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Analytical Context</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Cycle</span>
                                    <p className="font-black text-slate-900">{rating.year}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Approval</span>
                                    <p className="font-black text-green-600 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> YES
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Performance Rationale */}
            <div className="lg:col-span-2">
                <Card className="border-2 shadow-sm h-full">
                    <CardHeader className="bg-slate-50 border-b py-6">
                        <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" /> Analytical Rationale
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-10">
                        <div className="prose prose-slate max-w-none">
                            <p className="text-lg font-medium leading-relaxed text-slate-700 italic">
                                {rating.reason || "No qualitative narrative was provided for this historical session. Credit designation is based purely on the point-in-time quantitative snapshot."}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>

        {/* Scoring Detail Snapshot */}
        <Card className="border-2 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b py-8 px-10">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tight">Point-in-Time Analytical Snapshot</CardTitle>
                        <CardDescription className="font-medium text-slate-500">The specific quantitative variables used to derive this rating version.</CardDescription>
                    </div>
                    <Badge variant="outline" className="border-primary/20 text-primary font-black uppercase text-[10px] px-4 h-8 bg-primary/5">
                        Immutable Ledger Record
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table className="financial-table">
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="px-10 font-black text-slate-900 uppercase text-[10px] tracking-widest">Pillar Factor</TableHead>
                            <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest text-center">Observed Value</TableHead>
                            <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest text-center">Score (1-5)</TableHead>
                            <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest text-center">Model Weight</TableHead>
                            <TableHead className="text-right px-10 font-black text-slate-900 uppercase text-[10px] tracking-widest">Impact</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {snapshot?.breakdown ? (
                            snapshot.breakdown.map((p: any) => (
                                <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors border-b last:border-0">
                                    <TableCell className="px-10 py-6 font-bold text-slate-900">
                                        {p.name}
                                        <p className="text-[9px] text-slate-400 font-medium uppercase mt-0.5">{p.category}</p>
                                    </TableCell>
                                    <TableCell className="text-center font-mono font-bold text-primary">
                                        {p.actualValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className={cn(
                                            "font-black border-2",
                                            p.score >= 4 ? "border-green-200 bg-green-50 text-green-700" : p.score <= 2 ? "border-red-200 bg-red-50 text-red-700" : ""
                                        )}>
                                            {p.score}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center font-bold text-slate-500">{p.weight}%</TableCell>
                                    <TableCell className="text-right px-10 font-black text-slate-900">{p.impact.toFixed(2)}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic font-medium">
                                    Full parameter breakdown is unavailable for this rating version.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>
    </div>
  )
}
