
"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { 
    getCountries, 
    getFactSheet, 
    saveFactSheet, 
    saveRating, 
    getModels,
    getScales,
    getParameters,
    Country 
} from "@/lib/store"
import { 
    FactSheetData, 
    runDynamicRating,
    RatingModel,
    RatingScale,
    Parameter,
    evaluateFormula
} from "@/lib/rating-engine"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calculator, ChevronRight, Zap, ArrowUp, ArrowDown, CheckCircle, Loader2, Info, RefreshCw, Database } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { suggestFactSheetData } from "@/ai/flows/suggest-fact-sheet-data"

export default function RatingExecutionPage() {
    const { id } = useParams()
    const router = useRouter()
    const { toast } = useToast()
    
    const [country, setCountry] = useState<Country | null>(null)
    const [factSheet, setFactSheet] = useState<FactSheetData>({})
    const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set())
    const [models, setModels] = useState<RatingModel[]>([])
    const [scales, setScales] = useState<RatingScale[]>([])
    const [parameters, setParameters] = useState<Parameter[]>([])
    
    const [selectedModel, setSelectedModel] = useState<RatingModel | null>(null)
    const [selectedScale, setSelectedScale] = useState<RatingScale | null>(null)
    
    const [calculation, setCalculation] = useState<any>(null)
    const [isGenerating, setIsGenerating] = useState(false)
    const [rationale, setRationale] = useState("")
    const [step, setStep] = useState<"input" | "calculate" | "review">("input")
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            try {
                const [countriesData, modelsData, scalesData, paramsData] = await Promise.all([
                    getCountries(),
                    getModels(),
                    getScales(),
                    getParameters()
                ])
                
                const found = countriesData.find(c => c.id === id)
                if (found) {
                    setCountry(found)
                    const saved = await getFactSheet(found.id)
                    if (saved) setFactSheet(saved)
                }
                
                setModels(modelsData)
                setScales(scalesData)
                setParameters(paramsData)
                
                if (modelsData.length > 0) setSelectedModel(modelsData[0])
                if (scalesData.length > 0) setSelectedScale(scalesData[0])
            } catch (error) {
                console.error("Initialization Error:", error)
            } finally {
                setLoading(false) 
            }
        }
        load()
    }, [id])

    // Live derived metrics for the input view
    const liveDerivedMetrics = useMemo(() => {
        if (!parameters.length) return {};
        const context: Record<string, number> = {}; 
        
        // 1. Populate raw inputs into context
        parameters.forEach(p => {
            if (p.type === 'raw') {
                const rawVal = factSheet[p.id];
                const val = (rawVal !== undefined && rawVal !== null && rawVal !== "") ? Number(rawVal) : 0;
                
                const slugKey = (p.slug || "").toLowerCase().replace(/-/g, '_');
                const nameKey = (p.name || "").toLowerCase().replace(/[\s-]/g, '_');
                const idKey = (p.id || "").toLowerCase().replace(/-/g, '_');

                if (slugKey) context[slugKey] = val;
                if (nameKey) context[nameKey] = val;
                context[idKey] = val;
            }
        });
        
        // 2. Compute derived metrics for display
        const results: Record<string, number> = {};
        parameters.filter(p => p.type === 'derived').forEach(p => {
            const slug = (p.slug || "").toLowerCase().replace(/-/g, '_');
            const name = (p.name || "").toLowerCase().replace(/[\s-]/g, '_');
            
            if (slug === 'debt_to_gdp' || name === 'debt_to_gdp') {
                const debt = context['government_debt'] || context['debt'] || context['total_government_debt'] || 0;
                const gdp = context['gdp'] || context['nominal_gdp'] || context['gross_domestic_product'] || 1;
                results[p.id] = (debt / gdp) * 100;
            } else if (p.formula) {
                results[p.id] = evaluateFormula(p.formula, context);
            }
        });
        
        return results;
    }, [factSheet, parameters]);

    const handleRun = () => {
        if (!selectedModel || !selectedScale || !parameters.length) return
        
        const numericInputs: Record<string, number> = {};
        parameters.forEach(p => {
            const rawVal = factSheet[p.id];
            const value = (rawVal !== undefined && rawVal !== null && rawVal !== "") ? Number(rawVal) : 0;
            numericInputs[p.id] = value;
        });

        const result = runDynamicRating(numericInputs, selectedModel, selectedScale, parameters); 
        setCalculation(result)
        setStep("calculate")
    }

    const handleSuggest = async () => {
        if (!country) return;
        setIsGenerating(true)
        try {
            const suggested = await suggestFactSheetData({ countryName: country.name })
            const filled = new Set(autoFilledFields)
            setFactSheet(prev => {
                const next = { ...prev };
                parameters.forEach(p => {
                    const slugSource = p.slug || p.id || "";
                    const normSlug = slugSource.toLowerCase().replace(/-/g, '_');
                    const val = (suggested as any)[normSlug];
                    if (p.type === 'raw' && val !== undefined && val !== null) {
                        next[p.id] = val
                        filled.add(p.id)
                    }
                })
                return next;
            });
            setAutoFilledFields(filled)
            toast({ title: "AI Synthesis Complete" })
        } catch (e) {
            toast({ title: "AI Error", variant: "destructive" })
        } finally {
            setIsGenerating(false)
        }
    }

    const handleFinalize = async () => {
        if (!calculation || !country || !selectedModel || !selectedScale) return;
        await saveFactSheet(country.id, factSheet)
        await saveRating({
            countryId: country.id,
            modelId: selectedModel.id,
            scaleId: selectedScale.id,
            finalScore: calculation.finalScore,
            initialRating: calculation.initialRating,
            approvalStatus: 'pending',
            reason: rationale
        })
        toast({ title: "Rating Submitted" })
        router.push('/')
    }

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4"> 
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-slate-900">Execution: {country?.name}</h1>
                    <p className="text-primary font-bold uppercase text-xs tracking-widest mt-1">{step} Phase</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.back()} className="font-semibold">Cancel</Button>
                    {step === "input" && <Button onClick={handleRun} className="bg-primary font-bold shadow-md hover:shadow-lg transition-all"><Calculator className="w-4 h-4 mr-2" /> Run Analysis</Button>}
                    {step === "calculate" && <Button onClick={() => setStep("review")} className="bg-primary font-bold">Continue to Review <ChevronRight className="w-4 h-4 ml-2" /></Button>}
                    {step === "review" && <Button onClick={handleFinalize} className="bg-green-600 hover:bg-green-700 text-white font-bold"><CheckCircle className="w-4 h-4 mr-2" /> Finalize Rating</Button>}
                </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-12">
                <div className="lg:col-span-3">
                    <Card className="border-2 shadow-sm">
                        <CardHeader className="bg-slate-50 border-b pb-4"><CardTitle className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Analytical Framework</CardTitle></CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-900 uppercase">Model</label>
                                <Select onValueChange={(v) => setSelectedModel(models.find(m => m.id === v)!)} value={selectedModel?.id}>
                                    <SelectTrigger className="font-medium"><SelectValue /></SelectTrigger>
                                    <SelectContent>{models.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-900 uppercase">Scale</label>
                                <Select onValueChange={(v) => setSelectedScale(scales.find(s => s.id === v)!)} value={selectedScale?.id}>
                                    <SelectTrigger className="font-medium"><SelectValue /></SelectTrigger>
                                    <SelectContent>{scales.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-9">
                    {step === "input" && (
                        <div className="space-y-8">
                            <Card className="border-2 shadow-sm overflow-hidden">
                                <CardHeader className="flex flex-row items-center justify-between bg-white border-b py-6 px-8">
                                    <div>
                                        <CardTitle className="text-2xl font-black text-slate-900">Country Fact Sheet</CardTitle>
                                        <CardDescription className="text-slate-500 font-medium">Capture raw macroeconomic and fiscal variables.</CardDescription>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={handleSuggest} disabled={isGenerating} className="border-2 font-bold hover:bg-slate-50 transition-colors">
                                        <Zap className="w-3.5 h-3.5 mr-2 text-yellow-500 fill-yellow-500" /> GenAI Synthesis
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                                        {parameters.filter(p => p.type === 'raw').map((p) => (
                                            <div key={p.id} className="space-y-2">
                                                <label className="text-xs font-black text-slate-800 uppercase tracking-tighter flex justify-between">
                                                    {p.name}
                                                </label>
                                                <div className="relative group">
                                                    <Input 
                                                        type="number" 
                                                        value={factSheet[p.id] ?? ""} 
                                                        onChange={e => setFactSheet({...factSheet, [p.id]: e.target.value === "" ? "" : Number(e.target.value)})} 
                                                        className={cn(
                                                            "h-11 font-bold text-slate-900 transition-all border-2",
                                                            autoFilledFields.has(p.id) ? "bg-green-50/50 border-green-200 focus:border-green-400" : "focus:border-primary"
                                                        )} 
                                                    />
                                                    {autoFilledFields.has(p.id) && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-green-600 font-black bg-green-100 px-1.5 py-0.5 rounded">AI</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-xl font-black text-slate-900">Live Analytical Ratios</h2>
                                    <div className="h-px bg-slate-200 flex-1" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {parameters.filter(p => p.type === 'derived').map(p => (
                                        <div key={p.id} className="p-5 bg-white rounded-xl border-2 border-slate-100 shadow-sm flex justify-between items-start transition-all hover:border-primary/20 hover:shadow-md group">
                                            <div className="space-y-1.5">
                                                <p className="text-sm font-black text-slate-900 group-hover:text-primary transition-colors">{p.name}</p>
                                                {p.formula && (
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                                        <span className="text-slate-500 italic">Formula:</span> <span className="font-mono text-slate-600">{p.formula}</span>
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xl font-black text-primary leading-none tracking-tighter">
                                                    {(liveDerivedMetrics[p.id] ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === "calculate" && calculation && (
                        <Card className="border-2 shadow-sm">
                            <CardHeader className="border-b bg-slate-50/50">
                                <CardTitle className="text-2xl font-black text-slate-900">Quantitative Scoring Breakdown</CardTitle>
                                <CardDescription className="text-slate-500 font-medium">Scoring results mapped to analytical pillar weights.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table className="border-b">
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-black text-slate-900 uppercase text-[10px]">Analytical Parameter</TableHead>
                                            <TableHead className="font-black text-slate-900 uppercase text-[10px]">Final Value</TableHead>
                                            <TableHead className="font-black text-slate-900 uppercase text-[10px]">Trans. Score</TableHead>
                                            <TableHead className="font-black text-slate-900 uppercase text-[10px]">Weight</TableHead>
                                            <TableHead className="text-right font-black text-slate-900 uppercase text-[10px]">Impact</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Object.keys(selectedModel?.weights || {}).map((pid) => {
                                            const p = parameters.find(param => param.id === pid)
                                            const val = calculation.actualValuesUsed[pid] ?? 0;
                                            return (
                                                <TableRow key={pid} className="hover:bg-slate-50/50 transition-colors">
                                                    <TableCell className="font-bold text-slate-900">{p?.name || pid}</TableCell>
                                                    <TableCell className="font-black text-primary">
                                                        {val.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="font-bold text-slate-700">{calculation.transformedScores[pid]}</TableCell>
                                                    <TableCell className="text-slate-500 font-medium">{selectedModel?.weights[pid]}%</TableCell>
                                                    <TableCell className="text-right font-black text-slate-900">{(calculation.weightedScores[pid] || 0).toFixed(3)}</TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-white">
                                    <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl flex flex-col justify-between">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Aggregate Risk Score</p>
                                        <div className="text-6xl font-black tracking-tighter mt-2">{calculation.finalScore.toFixed(1)}%</div>
                                    </div>
                                    <div className="bg-primary text-white p-8 rounded-2xl shadow-xl flex flex-col justify-between border-4 border-white/20">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Implied Rating</p>
                                        <div className="text-6xl font-black tracking-tighter mt-2">{calculation.initialRating}</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}

