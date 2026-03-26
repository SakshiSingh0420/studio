
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
import { Calculator, ChevronRight, Zap, CheckCircle, Loader2, Settings2, ArrowDownNarrowWide, ArrowUpNarrowWide } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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

    // Precision Fix: Synchronized derived ratio display
    const liveDerivedMetrics = useMemo(() => {
        if (!parameters.length) return {};
        
        const context: Record<string, number> = {}; 
        parameters.forEach(p => {
            const rawVal = factSheet[p.id];
            const val = (rawVal !== undefined && rawVal !== null && rawVal !== "") ? Number(rawVal) : 0;
            
            // Map the value by ID, slug, and normalized names for robust formula evaluation
            context[p.id] = val;
            if (p.slug) context[p.slug.toLowerCase()] = val;
            if (p.name) context[p.name.toLowerCase().replace(/[\s-]/g, '_')] = val;
        });
        
        const results: Record<string, number> = {};
        parameters.filter(p => p.type === 'derived').forEach(p => {
            const slug = (p.slug || "").toLowerCase();
            const name = (p.name || "").toLowerCase();
            
            // Core sovereign ratios as requested
            if (slug.includes('debt_to_gdp') || name.includes('debt_to_gdp')) {
                const debt = context['government_debt'] || context['debt'] || 0;
                const gdp = context['gdp'] || context['nominal_gdp'] || 1;
                results[p.id] = (debt / gdp) * 100;
            } else if (slug.includes('reserve_cover') || name.includes('reserve_cover')) {
                const res = context['fx_reserves'] || context['reserves'] || 0;
                const imp = context['imports'] || 1;
                results[p.id] = res / imp;
            } else if (slug.includes('interest_to_revenue') || name.includes('interest_to_revenue')) {
                const int = context['interest_payments'] || context['interest'] || 0;
                const rev = context['government_revenue'] || context['revenue'] || 1;
                results[p.id] = (int / rev) * 100;
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
            numericInputs[p.id] = (rawVal !== undefined && rawVal !== null && rawVal !== "") ? Number(rawVal) : 0;
        });

        const result = runDynamicRating(numericInputs, selectedModel, selectedScale, parameters); 
        setCalculation(result)
        setStep("calculate")
        
        toast({ title: "Analysis Finalized", description: `Aggregate Score: ${result.finalScore.toFixed(1)}%` })
    }

    const handleSuggest = () => {
        if (!country) return;
        setIsGenerating(true)
        
        // Demo mode: Realistic India Sovereign Benchmarks
        const demoData: Record<string, number> = {
            gdp: 3400000000000, 
            gdp_growth: 6.5,
            gdp_per_capita: 2400,
            inflation: 5.5,
            government_debt: 3000000000000,
            government_revenue: 700000000000,
            interest_payments: 200000000000,
            fx_reserves: 600000000000,
            imports: 700000000000,
            exports: 670000000000,
            fiscal_balance: -6,
            political_stability: 0.5,
            governance_score: 0.6,
            climate_risk: 0.4,
            social_risk: 0.5,
            inflation_volatility: 2.5,
            exchange_rate_volatility: 3
        };

        const filled = new Set<string>();
        const nextFactSheet = { ...factSheet };

        parameters.forEach(p => {
            if (p.type !== 'raw') return;
            const slug = (p.slug || "").toLowerCase().replace(/[-\s]/g, '_');
            const name = (p.name || "").toLowerCase().replace(/[\s-]/g, '_');
            const val = demoData[slug] ?? demoData[name] ?? demoData[p.id];
            if (val !== undefined) {
                nextFactSheet[p.id] = val;
                filled.add(p.id);
            }
        });

        setFactSheet(nextFactSheet);
        setAutoFilledFields(filled);
        setIsGenerating(false);
        toast({ title: "Demo Data Populated", description: "Harvested latest sovereign benchmarks." })
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
        toast({ title: "Rating Session Submitted" })
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
                                    <SelectTrigger className="font-medium h-11"><SelectValue /></SelectTrigger>
                                    <SelectContent>{models.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-900 uppercase">Scale</label>
                                <Select onValueChange={(v) => setSelectedScale(scales.find(s => s.id === v)!)} value={selectedScale?.id}>
                                    <SelectTrigger className="font-medium h-11"><SelectValue /></SelectTrigger>
                                    <SelectContent>{scales.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-9">
                    {step === "input" && (
                        <div className="space-y-12">
                            <Card className="border-2 shadow-sm overflow-hidden">
                                <CardHeader className="flex flex-row items-center justify-between bg-white border-b py-8 px-10">
                                    <div>
                                        <CardTitle className="text-3xl font-black text-slate-900">Country Fact Sheet</CardTitle>
                                        <CardDescription className="text-slate-500 font-medium text-base mt-1">Capture macroeconomic and fiscal variables for analysis.</CardDescription>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={handleSuggest} disabled={isGenerating} className="border-2 font-bold h-10 px-6 hover:bg-slate-50 transition-colors">
                                        <Zap className="w-3.5 h-3.5 mr-2 text-yellow-500 fill-yellow-500" /> Auto Fetch Data
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-10">
                                        {parameters.filter(p => p.type === 'raw').map((p) => (
                                            <div key={p.id} className="space-y-3">
                                                <label className="text-base font-black text-slate-900 uppercase tracking-tight">
                                                    {p.name}
                                                </label>
                                                <div className="relative group">
                                                    <Input 
                                                        type="number" 
                                                        value={factSheet[p.id] ?? ""} 
                                                        onChange={e => setFactSheet({...factSheet, [p.id]: e.target.value === "" ? "" : Number(e.target.value)})} 
                                                        className={cn(
                                                            "h-14 text-xl font-bold text-slate-900 transition-all border-2",
                                                            autoFilledFields.has(p.id) ? "bg-green-50/50 border-green-200 focus:border-green-400" : "focus:border-primary border-slate-200"
                                                        )} 
                                                    />
                                                    {autoFilledFields.has(p.id) && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-green-700 font-black bg-green-100 px-2 py-1 rounded">AUTO DATA</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="space-y-8">
                                <div className="flex items-center gap-4">
                                    <h2 className="text-3xl font-black text-slate-900">Live Analytical Ratios</h2>
                                    <div className="h-1 bg-slate-200 flex-1 rounded-full" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {parameters.filter(p => p.type === 'derived').map(p => {
                                        const slug = (p.slug || "").toLowerCase();
                                        const name = (p.name || "").toLowerCase();
                                        let formulaDisplay = p.formula || 'Custom Logic';
                                        
                                        if (slug.includes('debt_to_gdp') || name.includes('debt_to_gdp')) formulaDisplay = '(Debt / GDP) × 100';
                                        else if (slug.includes('reserve_cover') || name.includes('reserve_cover')) formulaDisplay = 'Reserves / Imports';
                                        else if (slug.includes('interest_to_revenue') || name.includes('interest_to_revenue')) formulaDisplay = '(Interest / Revenue) × 100';

                                        return (
                                            <div key={p.id} className="p-8 bg-white rounded-2xl border-2 border-slate-100 shadow-sm flex flex-col justify-between transition-all hover:border-primary/30 hover:shadow-md group">
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-start">
                                                        <p className="text-lg font-black text-slate-900 group-hover:text-primary transition-colors">{p.name}</p>
                                                        <Settings2 className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" />
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-4xl font-black text-primary leading-none tracking-tighter">
                                                            {(liveDerivedMetrics[p.id] ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="mt-8 pt-5 border-t border-slate-50">
                                                    <p className="text-xs text-slate-600 font-bold uppercase tracking-widest flex items-center gap-2">
                                                        <span className="text-slate-400 italic font-medium">Formula:</span> 
                                                        <span className="font-mono text-slate-800 bg-slate-50 px-2.5 py-1 rounded-md">
                                                            {formulaDisplay}
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === "calculate" && calculation && (
                        <Card className="border-2 shadow-sm">
                            <CardHeader className="border-b bg-slate-50/50 py-10 px-12">
                                <CardTitle className="text-3xl font-black text-slate-900">Quantitative Scoring Breakdown</CardTitle>
                                <CardDescription className="text-slate-600 font-medium text-lg mt-2">Analytical results mapped from fact sheet variables to framework scoring buckets.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table className="border-b">
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-black text-slate-900 uppercase text-xs py-5 px-12">Parameter</TableHead>
                                            <TableHead className="font-black text-slate-900 uppercase text-xs py-5">Value</TableHead>
                                            <TableHead className="font-black text-slate-900 uppercase text-xs py-5 text-center">Benchmarks</TableHead>
                                            <TableHead className="font-black text-slate-900 uppercase text-xs py-5">Score</TableHead>
                                            <TableHead className="font-black text-slate-900 uppercase text-xs py-5">Weight</TableHead>
                                            <TableHead className="text-right font-black text-slate-900 uppercase text-xs py-5 px-12">Impact</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Object.keys(selectedModel?.weights || {}).map((pid) => {
                                            const p = parameters.find(param => param.id === pid)
                                            const val = calculation.actualValuesUsed[pid] ?? 0;
                                            const score = calculation.transformedScores[pid] || 1;
                                            const weight = Number(selectedModel?.weights[pid]) || 0;
                                            const impact = calculation.weightedScores[pid] || 0;
                                            const transConfig = selectedModel?.transformations?.[pid] || null;
                                            
                                            return (
                                                <TableRow key={pid} className="hover:bg-slate-50/50 transition-colors">
                                                    <TableCell className="font-bold text-slate-900 px-12 py-6 text-base">{p?.name || pid}</TableCell>
                                                    <TableCell className="font-black text-primary text-lg">
                                                        {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div className="flex flex-col items-center gap-1 cursor-help">
                                                                        <div className="flex items-center gap-1">
                                                                            {transConfig?.inverse ? <ArrowDownNarrowWide className="w-3 h-3 text-red-500" /> : <ArrowUpNarrowWide className="w-3 h-3 text-green-500" />}
                                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                                                                {transConfig?.inverse ? 'Inverse' : 'Standard'}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex gap-0.5">
                                                                            {transConfig?.thresholds.map((t: number, i: number) => (
                                                                                <div key={i} className="w-4 h-1 rounded-full bg-slate-200" />
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="p-3 bg-slate-900 text-white border-none shadow-2xl">
                                                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Threshold Ranges</p>
                                                                    <div className="grid grid-cols-4 gap-3 font-mono text-xs">
                                                                        {transConfig?.thresholds.map((t: number, i: number) => (
                                                                            <div key={i} className="text-center">
                                                                                <p className="text-[9px] text-slate-500 mb-1">SCORE {i+2}</p>
                                                                                <p className="font-bold">{t}</p>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </TableCell>
                                                    <TableCell className="font-bold text-slate-800">
                                                        <Badge variant="outline" className="text-base font-black border-2 px-3 py-1 bg-white">
                                                            {score}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-slate-700 font-bold text-base">{weight}%</TableCell>
                                                    <TableCell className="text-right font-black text-slate-900 px-12 text-lg">
                                                        {impact.toFixed(2)}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                                <div className="p-12 grid grid-cols-1 md:grid-cols-2 gap-12 bg-white">
                                    <div className="bg-slate-900 text-white p-12 rounded-[2.5rem] shadow-xl flex flex-col justify-between border-b-8 border-slate-700">
                                        <p className="text-xs font-black uppercase tracking-[0.25em] opacity-60">Aggregate Risk Score</p>
                                        <div className="text-8xl font-black tracking-tighter mt-6">{calculation.finalScore.toFixed(1)}%</div>
                                    </div>
                                    <div className="bg-primary text-white p-12 rounded-[2.5rem] shadow-xl flex flex-col justify-between border-4 border-white/20 border-b-8 border-primary-foreground/30">
                                        <p className="text-xs font-black uppercase tracking-[0.25em] opacity-60">Implied Rating</p>
                                        <div className="text-8xl font-black tracking-tighter mt-6">{calculation.initialRating}</div>
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
