
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
import { Calculator, ChevronRight, Zap, ArrowUp, ArrowDown, CheckCircle, Loader2, Info, RefreshCw, Database, Settings2 } from "lucide-react"
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

    // Live derived metrics for the input view
    const liveDerivedMetrics = useMemo(() => {
        if (!parameters.length) return {};
        const context: Record<string, number> = {}; 
        
        // 1. Populate raw inputs into context
        parameters.forEach(p => {
            if (p.type === 'raw') {
                const rawVal = factSheet[p.id];
                const val = (rawVal !== undefined && rawVal !== null && rawVal !== "") ? Number(rawVal) : 0;
                
                const slugKey = (p.slug || p.id || "").toLowerCase().replace(/-/g, '_');
                const nameKey = (p.name || "").toLowerCase().replace(/[\s-]/g, '_');

                if (slugKey) context[slugKey] = val;
                if (nameKey) context[nameKey] = val;
            }
        });
        
        // 2. Compute derived metrics for display
        const results: Record<string, number> = {};
        parameters.filter(p => p.type === 'derived').forEach(p => {
            const slug = (p.slug || "").toLowerCase().replace(/-/g, '_');
            const name = (p.name || "").toLowerCase().replace(/[\s-]/g, '_');
            
            // Failsafe 1: Debt to GDP
            if (slug === 'debt_to_gdp' || name === 'debt_to_gdp') {
                const debt = context['government_debt'] || context['debt'] || context['total_government_debt'] || 0;
                const gdp = context['gdp'] || context['nominal_gdp'] || context['gross_domestic_product'] || 1;
                results[p.id] = (debt / (gdp || 1)) * 100;
            } 
            // Failsafe 2: Reserve Cover
            else if (slug === 'reserve_cover' || name === 'reserve_cover') {
                const res = context['fx_reserves'] || context['reserves'] || context['foreign_exchange_reserves'] || 0;
                const imp = context['imports'] || context['total_imports'] || 0;
                results[p.id] = imp === 0 ? 0 : (res / imp);
            }
            // Failsafe 3: Interest to Revenue
            else if (slug === 'interest_to_revenue' || name === 'interest_to_revenue') {
                const interest = context['interest_payments'] || context['interest'] || context['government_interest_payments'] || 0;
                const revenue = context['government_revenue'] || context['revenue'] || context['total_revenue'] || 1;
                results[p.id] = (interest / (revenue || 1)) * 100;
            }
            // General Formula Pass
            else if (p.formula) {
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
        
        // Use realistic demo values for India (as requested)
        const demoData: Record<string, number> = {
            gdp: 3400000000000,
            gdp_growth: 6.5,
            gdp_per_capita: 2400,
            inflation: 5.5,
            debt: 3000000000000,
            government_debt: 3000000000000,
            revenue: 700000000000,
            government_revenue: 700000000000,
            interest: 200000000000,
            interest_payments: 200000000000,
            fx_reserves: 600000000000,
            imports: 700000000000,
            exports: 670000000000,
            fiscal_balance: -6,
            inflation_volatility: 2.5,
            exchange_rate_volatility: 3,
            political_stability: 0.5,
            governance_score: 0.6,
            climate_risk: 0.4,
            social_risk: 0.5
        };

        // Simulate a short processing delay for UX
        await new Promise(resolve => setTimeout(resolve, 600));

        const filled = new Set(autoFilledFields)
        setFactSheet(prev => {
            const next = { ...prev };
            parameters.forEach(p => {
                if (p.type !== 'raw') return;

                const slug = (p.slug || "").toLowerCase().replace(/-/g, '_');
                const name = (p.name || "").toLowerCase().replace(/[\s-]/g, '_');
                
                // Try to find a match in the demo data
                let val = undefined;

                if (demoData[slug] !== undefined) val = demoData[slug];
                else if (demoData[name] !== undefined) val = demoData[name];
                else if (demoData[p.id] !== undefined) val = demoData[p.id];
                
                // Fuzzy Mapping for common naming variations
                else if (slug.includes('gdp') && !slug.includes('growth')) val = demoData.gdp;
                else if (slug.includes('debt')) val = demoData.government_debt;
                else if (slug.includes('revenue')) val = demoData.government_revenue;
                else if (slug.includes('interest')) val = demoData.interest_payments;
                else if (slug.includes('reserves') || slug.includes('fx')) val = demoData.fx_reserves;
                else if (slug.includes('imports')) val = demoData.imports;
                else if (slug.includes('exports')) val = demoData.exports;

                if (val !== undefined && val !== null) {
                    next[p.id] = val;
                    filled.add(p.id);
                }
            })
            return next;
        });
        setAutoFilledFields(filled)
        setIsGenerating(false)
        toast({ title: "Auto Data Loaded", description: "Economic profile updated with realistic demo values." })
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
                                        <CardTitle className="text-2xl font-black text-slate-900">Country Fact Sheet</CardTitle>
                                        <CardDescription className="text-slate-500 font-medium text-sm">Capture raw macroeconomic and fiscal variables.</CardDescription>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={handleSuggest} disabled={isGenerating} className="border-2 font-bold h-10 px-6 hover:bg-slate-50 transition-colors">
                                        <Zap className="w-3.5 h-3.5 mr-2 text-yellow-500 fill-yellow-500" /> Auto Fetch Data
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8">
                                        {parameters.filter(p => p.type === 'raw').map((p) => (
                                            <div key={p.id} className="space-y-3">
                                                <label className="text-sm font-black text-slate-900 uppercase tracking-tight flex justify-between">
                                                    {p.name}
                                                </label>
                                                <div className="relative group">
                                                    <Input 
                                                        type="number" 
                                                        value={factSheet[p.id] ?? ""} 
                                                        onChange={e => setFactSheet({...factSheet, [p.id]: e.target.value === "" ? "" : Number(e.target.value)})} 
                                                        className={cn(
                                                            "h-12 text-lg font-bold text-slate-900 transition-all border-2",
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
                                    <h2 className="text-2xl font-black text-slate-900">Live Analytical Ratios</h2>
                                    <div className="h-0.5 bg-slate-200 flex-1" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {parameters.filter(p => p.type === 'derived').map(p => {
                                        const slug = (p.slug || "").toLowerCase().replace(/-/g, '_');
                                        const name = (p.name || "").toLowerCase().replace(/[\s-]/g, '_');
                                        let formulaDisplay = p.formula || 'Custom Logic';
                                        
                                        if (slug === 'debt_to_gdp' || name === 'debt_to_gdp') formulaDisplay = '(debt / gdp) * 100';
                                        if (slug === 'reserve_cover' || name === 'reserve_cover') formulaDisplay = 'fx_reserves / imports';
                                        if (slug === 'interest_to_revenue' || name === 'interest_to_revenue') formulaDisplay = '(interest / revenue) * 100';

                                        return (
                                            <div key={p.id} className="p-6 bg-white rounded-2xl border-2 border-slate-100 shadow-sm flex flex-col justify-between transition-all hover:border-primary/30 hover:shadow-md group">
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <p className="text-base font-black text-slate-900 group-hover:text-primary transition-colors">{p.name}</p>
                                                        <Settings2 className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-3xl font-black text-primary leading-none tracking-tighter">
                                                            {(liveDerivedMetrics[p.id] ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="mt-6 pt-4 border-t border-slate-50">
                                                    <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                                                        <span className="text-slate-400 italic font-medium">Formula:</span> 
                                                        <span className="font-mono text-slate-700 bg-slate-50 px-2 py-0.5 rounded">
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
                            <CardHeader className="border-b bg-slate-50/50 py-8 px-10">
                                <CardTitle className="text-2xl font-black text-slate-900">Quantitative Scoring Breakdown</CardTitle>
                                <CardDescription className="text-slate-500 font-medium">Scoring results mapped to analytical pillar weights.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table className="border-b">
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-black text-slate-900 uppercase text-[11px] py-4 px-10">Analytical Parameter</TableHead>
                                            <TableHead className="font-black text-slate-900 uppercase text-[11px] py-4">Final Value</TableHead>
                                            <TableHead className="font-black text-slate-900 uppercase text-[11px] py-4">Trans. Score</TableHead>
                                            <TableHead className="font-black text-slate-900 uppercase text-[11px] py-4">Weight</TableHead>
                                            <TableHead className="text-right font-black text-slate-900 uppercase text-[11px] py-4 px-10">Impact</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Object.keys(selectedModel?.weights || {}).map((pid) => {
                                            const p = parameters.find(param => param.id === pid)
                                            const val = calculation.actualValuesUsed[pid] ?? 0;
                                            return (
                                                <TableRow key={pid} className="hover:bg-slate-50/50 transition-colors">
                                                    <TableCell className="font-bold text-slate-900 px-10 py-5">{p?.name || pid}</TableCell>
                                                    <TableCell className="font-black text-primary text-base">
                                                        {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="font-bold text-slate-700">{calculation.transformedScores[pid]}</TableCell>
                                                    <TableCell className="text-slate-500 font-medium">{selectedModel?.weights[pid]}%</TableCell>
                                                    <TableCell className="text-right font-black text-slate-900 px-10">{(calculation.weightedScores[pid] || 0).toFixed(3)}</TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                                <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10 bg-white">
                                    <div className="bg-slate-900 text-white p-10 rounded-3xl shadow-xl flex flex-col justify-between border-b-8 border-slate-700">
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60">Aggregate Risk Score</p>
                                        <div className="text-7xl font-black tracking-tighter mt-4">{calculation.finalScore.toFixed(1)}%</div>
                                    </div>
                                    <div className="bg-primary text-white p-10 rounded-3xl shadow-xl flex flex-col justify-between border-4 border-white/20 border-b-8 border-primary-foreground/30">
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60">Implied Rating</p>
                                        <div className="text-7xl font-black tracking-tighter mt-4">{calculation.initialRating}</div>
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
