"use client"

import { useState, useEffect } from "react"
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
    Parameter
} from "@/lib/rating-engine"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calculator, ChevronRight, Zap, ArrowUp, ArrowDown, CheckCircle, Loader2, Info, RefreshCw, Database } from "lucide-react"
import { generateRatingRationale } from "@/ai/flows/generate-rating-rationale"
import { suggestFactSheetData } from "@/ai/flows/suggest-fact-sheet-data"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// Enterprise Market Data Mock (Simulating Bloomberg/Reuters/IMF Data Feed)
const MOCK_MARKET_DATA: Record<string, Record<string, number>> = {
    "India": {
        "gdp": 3400000000000,
        "gdp_growth": 6.8,
        "inflation": 5.1,
        "fx_reserves": 640000000000,
        "debt": 81.5,
        "governance_score": 0.65,
        "political_stability": 0.55,
        "interest": 22000000000,
        "imports": 740000000000,
        "exports": 680000000000,
        "revenue": 590000000000,
        "external_debt": 620000000000
    },
    "USA": {
        "gdp": 27000000000000,
        "gdp_growth": 2.5,
        "inflation": 3.1,
        "fx_reserves": 240000000000,
        "debt": 122.3,
        "governance_score": 0.88,
        "political_stability": 0.75,
        "interest": 680000000000,
        "imports": 3600000000000,
        "exports": 2900000000000,
        "revenue": 5000000000000,
        "external_debt": 25000000000000
    },
    "Brazil": {
        "gdp": 2000000000000,
        "gdp_growth": 3.0,
        "inflation": 4.2,
        "fx_reserves": 350000000000,
        "debt": 74.0,
        "governance_score": 0.52,
        "political_stability": 0.45,
        "interest": 98000000000,
        "imports": 260000000000,
        "exports": 310000000000,
        "revenue": 330000000000,
        "external_debt": 680000000000
    }
}

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
    const [isFetchingAuto, setIsFetchingAuto] = useState(false)
    const [rationale, setRationale] = useState("")
    const [adjustment, setAdjustment] = useState<number>(0)
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
                    if (saved) {
                        setFactSheet(saved)
                    } else {
                        // Attempt initial auto-fill if no existing fact sheet
                        const mockData = MOCK_MARKET_DATA[found.name]
                        if (mockData) {
                            const newData: any = {}
                            const filled = new Set<string>()
                            paramsData.forEach(p => {
                                if (p.type === 'raw' && (p.dataSource === 'IMF (Auto)' || p.dataSource === 'World Bank (Auto)')) {
                                    const val = mockData[p.slug]
                                    if (val !== undefined) {
                                        newData[p.id] = val
                                        filled.add(p.id)
                                    }
                                }
                            })
                            setFactSheet(newData)
                            setAutoFilledFields(filled)
                        }
                    }
                }
                
                setModels(modelsData)
                setScales(scalesData)
                setParameters(paramsData)
                
                if (modelsData.length > 0) setSelectedModel(modelsData[0])
                if (scalesData.length > 0) setSelectedScale(scalesData[0])
            } catch (error) {
                console.error("Initialization error:", error)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [id])

    /**
     * Explicit handler for the Auto Fetch Data button.
     * Triggers population from mock enterprise sources.
     */
    const handleAutoFill = async () => {
        if (!country || !parameters.length) return
        setIsFetchingAuto(true)
        console.log(`Auto-fetch synchronization triggered for ${country.name}`);
        
        // Simulating data synchronization latency
        await new Promise(r => setTimeout(r, 1000))
        
        const mockData = MOCK_MARKET_DATA[country.name]
        if (!mockData) {
            toast({ 
                title: "Source Data Unavailable", 
                description: `No automated source data found for ${country.name} in the analytical repository.`, 
                variant: "destructive" 
            })
            setIsFetchingAuto(false)
            return
        }

        const updatedFactSheet = { ...factSheet }
        const updatedFilled = new Set(autoFilledFields)
        let syncCount = 0

        parameters.forEach(p => {
            // Only target parameters defined as Auto from IMF or World Bank
            if (p.type === 'raw' && (p.dataSource === 'IMF (Auto)' || p.dataSource === 'World Bank (Auto)')) {
                const val = mockData[p.slug]
                if (val !== undefined) {
                    // Safety check: Preserve manual entries unless they are zero or undefined
                    if (!factSheet[p.id] || factSheet[p.id] === 0) {
                        updatedFactSheet[p.id] = val
                        updatedFilled.add(p.id)
                        syncCount++
                    }
                }
            }
        })

        // Bulk update state to ensure UI responsiveness
        setFactSheet(updatedFactSheet)
        setAutoFilledFields(updatedFilled)
        
        toast({ 
            title: "Data Synchronized", 
            description: `Successfully synchronized ${syncCount} automated parameters for ${country.name}.` 
        })
        setIsFetchingAuto(false)
    }

    const handleRun = () => {
        if (!selectedModel || !selectedScale) {
            toast({ title: "Configuration Error", description: "Please select a model and scale." })
            return
        }
        const result = runDynamicRating(factSheet as Record<string, number>, selectedModel, selectedScale, parameters)
        setCalculation(result)
        setStep("calculate")
    }

    const handleSuggest = async () => {
        if (!country) return;
        setIsGenerating(true)
        try {
            const suggested = await suggestFactSheetData({ countryName: country.name })
            const merged = { ...factSheet }
            const filled = new Set(autoFilledFields)
            
            parameters.forEach(p => {
                if (p.type === 'raw' && (suggested as any)[p.slug] !== undefined) {
                    if (!factSheet[p.id] || factSheet[p.id] === 0) {
                        merged[p.id] = (suggested as any)[p.slug]
                        filled.add(p.id)
                    }
                }
            })
            setFactSheet(merged)
            setAutoFilledFields(filled)
            toast({ title: "AI Synthesis Complete", description: "Fact sheet updated with market-derived AI suggestions." })
        } catch (e) {
            toast({ title: "AI Service Error", variant: "destructive", description: "Could not retrieve analytical suggestions." })
        } finally {
            setIsGenerating(false)
        }
    }

    const handleGenerateRationale = async () => {
        if (!calculation || !country || !selectedModel || !selectedScale) return;
        setIsGenerating(true)
        try {
            const res = await generateRatingRationale({
                country,
                factSheetData: factSheet,
                model: selectedModel as any,
                ratingScale: selectedScale as any,
                derivedMetrics: calculation.derivedMetrics,
                transformedScores: calculation.transformedScores,
                weightedScores: calculation.weightedScores,
                finalScore: calculation.finalScore,
                initialRating: calculation.initialRating
            })
            setRationale(res.rationale)
        } catch (e) {
            toast({ title: "Rationale Error", variant: "destructive", description: "Failed to generate AI rationale." })
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
            rawData: factSheet,
            derivedMetrics: calculation.derivedMetrics,
            transformedScores: calculation.transformedScores,
            weightedScores: calculation.weightedScores,
            finalScore: calculation.finalScore,
            initialRating: calculation.initialRating,
            approvalStatus: 'pending',
            reason: rationale
        })
        toast({ title: "Session archived", description: "Rating results have been submitted for committee signature." })
        router.push('/')
    }

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>
    if (!country) return <div className="p-8 text-center font-bold">Country record not found.</div>

    const rawParameters = parameters.filter(p => p.type === 'raw');
    const derivedParameters = parameters.filter(p => p.type === 'derived');

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-primary">Execute Rating: {country.name}</h1>
                    <p className="text-muted-foreground mt-1 text-lg">Phase: <span className="capitalize text-foreground font-semibold">{step}</span></p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.back()}>Abort</Button>
                    {step === "input" && <Button onClick={handleRun} className="bg-primary"><Calculator className="w-4 h-4 mr-2" /> Run Analysis</Button>}
                    {step === "calculate" && <Button onClick={() => setStep("review")} className="bg-primary">Continue Review <ChevronRight className="w-4 h-4 ml-2" /></Button>}
                    {step === "review" && <Button onClick={handleFinalize} className="bg-green-600 hover:bg-green-700 text-white"><CheckCircle className="w-4 h-4 mr-2" /> Finalize Decision</Button>}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-3 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Analytic Framework</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold">Analytical Model</label>
                                <Select onValueChange={(v) => setSelectedModel(models.find(m => m.id === v)!)} value={selectedModel?.id}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {models.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold">Rating Scale</label>
                                <Select onValueChange={(v) => setSelectedScale(scales.find(s => s.id === v)!)} value={selectedScale?.id}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Scale" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {scales.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {selectedModel && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Pillar Weights</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {Object.entries(selectedModel.weights).map(([k, v]) => {
                                    const p = parameters.find(param => param.id === k)
                                    return (
                                        <div key={k} className="flex justify-between text-xs border-b pb-1 last:border-0">
                                            <span className="truncate pr-2">{p?.name || k}</span>
                                            <span className="font-bold text-primary">{v}%</span>
                                        </div>
                                    )
                                })}
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="lg:col-span-9">
                    {step === "input" && (
                        <Card>
                            <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-6">
                                <div>
                                    <CardTitle>Sovereign Fact Sheet</CardTitle>
                                    <CardDescription>Aggregate raw data points for current reporting cycle.</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={handleAutoFill} disabled={isFetchingAuto} className="border-green-200 text-green-700 hover:bg-green-50 shadow-sm">
                                        <RefreshCw className={cn("w-3.5 h-3.5 mr-2", isFetchingAuto && "animate-spin")} /> {isFetchingAuto ? "Synchronizing..." : "Auto Fetch Data"}
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={handleSuggest} disabled={isGenerating} className="shadow-sm">
                                        <Zap className="w-3.5 h-3.5 mr-2 text-yellow-500" /> {isGenerating ? "Synthesizing AI..." : "AI Suggestions"}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {rawParameters.map((p) => {
                                        const isAuto = p.dataSource === 'IMF (Auto)' || p.dataSource === 'World Bank (Auto)';
                                        const isFilled = autoFilledFields.has(p.id);

                                        return (
                                            <div key={p.id} className="space-y-1.5 group relative">
                                                <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                                                    <span className="flex items-center gap-1.5">
                                                        {p.name}
                                                        {isAuto && <Database className="w-3 h-3 text-green-500 opacity-60" />}
                                                    </span>
                                                    <span className="text-[9px] font-mono opacity-40 uppercase tracking-tighter">{p.slug}</span>
                                                </label>
                                                <div className="relative">
                                                    <Input 
                                                        type="number" 
                                                        value={factSheet[p.id] ?? 0} 
                                                        onChange={e => {
                                                            const val = e.target.value === "" ? 0 : Number(e.target.value)
                                                            setFactSheet({...factSheet, [p.id]: val})
                                                            // Manual override clears the auto-filled badge
                                                            const newFilled = new Set(autoFilledFields)
                                                            newFilled.delete(p.id)
                                                            setAutoFilledFields(newFilled)
                                                        }} 
                                                        className={cn(
                                                            "h-10 transition-all font-mono",
                                                            isFilled && "bg-green-50/40 border-green-200 focus:bg-background pr-16"
                                                        )}
                                                    />
                                                    {isFilled && (
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-green-600 font-black uppercase pointer-events-none">
                                                            Auto
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {rawParameters.length === 0 && (
                                        <div className="col-span-full py-20 text-center border-2 border-dashed rounded-lg bg-muted/20">
                                            <p className="text-sm text-muted-foreground font-medium">No input parameters registered. Access Configuration &gt; Parameter Master.</p>
                                        </div>
                                    )}
                                </div>

                                {derivedParameters.length > 0 && (
                                    <div className="mt-12 pt-8 border-t">
                                        <h3 className="text-sm font-bold mb-6 flex items-center gap-2">
                                            Calculated Ratios & Logic (Resolved on Run)
                                            <Info className="w-4 h-4 text-muted-foreground opacity-70" />
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {derivedParameters.map(p => (
                                                <div key={p.id} className="p-4 bg-muted/10 rounded-lg border border-border/40 flex justify-between items-center group hover:bg-muted/30 transition-colors">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold truncate">{p.name}</p>
                                                        <p className="text-[10px] text-muted-foreground font-mono mt-1 bg-background inline-block px-1.5 py-0.5 rounded truncate max-w-full">{p.formula}</p>
                                                    </div>
                                                    <Badge variant="outline" className="text-[9px] uppercase font-mono border-none bg-muted/50">Derived</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {step === "calculate" && calculation && selectedModel && (
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Analytical Breakdown</CardTitle>
                                    <CardDescription>Quantifying sovereign risk through factor-weighted transformation.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table className="financial-table border rounded-xl overflow-hidden shadow-sm">
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead>Risk Identifier</TableHead>
                                                <TableHead>Final Value</TableHead>
                                                <TableHead>Trans. Score (1-5)</TableHead>
                                                <TableHead>Model Weight</TableHead>
                                                <TableHead className="text-right">Factor Impact</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {Object.keys(selectedModel.weights).map((pid) => {
                                                const p = parameters.find(param => param.id === pid)
                                                const isDerived = p?.type === 'derived';
                                                const val = isDerived ? calculation.derivedMetrics[pid] : factSheet[pid];
                                                
                                                return (
                                                    <TableRow key={pid} className="hover:bg-muted/20">
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-sm">{p?.name || pid}</span>
                                                                <span className="text-[9px] text-muted-foreground font-mono uppercase truncate max-w-[200px]">{isDerived ? `Formula: ${p?.formula}` : p?.slug}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className={cn("font-mono", isDerived && "text-primary font-black")}>
                                                            {typeof val === 'number' ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : (val || 0)}
                                                        </TableCell>
                                                        <TableCell className="text-center font-extrabold text-primary">{calculation.transformedScores[pid]}</TableCell>
                                                        <TableCell className="text-muted-foreground">{selectedModel.weights[pid]}%</TableCell>
                                                        <TableCell className="text-right font-mono font-black bg-muted/10">
                                                            {calculation.weightedScores[pid].toFixed(3)}
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                    <div className="mt-8 grid grid-cols-2 gap-6">
                                        <div className="bg-primary text-white p-8 rounded-2xl shadow-xl flex flex-col justify-center relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                                <TrendingUp className="w-24 h-24" />
                                            </div>
                                            <p className="text-[10px] uppercase font-black opacity-80 tracking-[0.2em]">Aggregate Quantitative Score</p>
                                            <div className="text-6xl font-black mt-2 leading-none">{calculation.finalScore.toFixed(1)}<span className="text-xl font-medium opacity-50 ml-1">%</span></div>
                                        </div>
                                        <div className="bg-white p-8 rounded-2xl shadow-xl border-4 border-primary/10 flex flex-col justify-center relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                                <ShieldCheck className="w-24 h-24 text-primary" />
                                            </div>
                                            <p className="text-[10px] uppercase font-black text-primary opacity-80 tracking-[0.2em]">Implied Credit Rating</p>
                                            <div className="text-6xl font-black text-primary mt-2 leading-none">{calculation.initialRating}</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {step === "review" && calculation && (
                        <div className="grid gap-6 md:grid-cols-2">
                            <Card className="shadow-lg border-t-4 border-t-primary">
                                <CardHeader className="bg-muted/20">
                                    <CardTitle>Qualitative Adjustments</CardTitle>
                                    <CardDescription>Overriding quantitative indicators with market signals.</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-8 space-y-8">
                                    <div className="flex gap-4">
                                        <Button variant="outline" className="flex-1 h-20 text-lg font-black border-2 hover:bg-green-50 hover:border-green-300 transition-all" onClick={() => setAdjustment(prev => prev + 1)}>
                                            <ArrowUp className="w-6 h-6 mr-2 text-green-600" /> Notch Upgrade
                                        </Button>
                                        <Button variant="outline" className="flex-1 h-20 text-lg font-black border-2 hover:bg-red-50 hover:border-red-300 transition-all" onClick={() => setAdjustment(prev => prev - 1)}>
                                            <ArrowDown className="w-6 h-6 mr-2 text-red-600" /> Notch Downgrade
                                        </Button>
                                    </div>
                                    <div className="p-8 bg-muted/30 rounded-2xl border-2 border-dashed border-primary/20 text-center">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Target Designation</p>
                                        <p className="text-6xl font-black text-primary mt-3">{calculation.initialRating}</p>
                                        <p className="text-xs font-bold text-muted-foreground mt-4">Manual Bias applied: {adjustment > 0 ? `+${adjustment}` : adjustment} notch(es)</p>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-xs font-black uppercase text-muted-foreground">Analyst Rationale</label>
                                        <textarea 
                                            className="w-full min-h-[140px] p-5 text-sm rounded-2xl border-2 focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all bg-background resize-none" 
                                            placeholder="Document qualitative context for final committee review..." 
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="shadow-lg flex flex-col border-t-4 border-t-accent">
                                <CardHeader className="bg-muted/20 flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>AI Analytical Narrative</CardTitle>
                                        <CardDescription>Synthesizing rationale from session metrics.</CardDescription>
                                    </div>
                                    <Button size="sm" variant="secondary" onClick={handleGenerateRationale} disabled={isGenerating} className="shadow-sm font-bold">
                                        <Zap className="w-4 h-4 mr-2" /> {isGenerating ? "Synthesizing..." : "Generate Report"}
                                    </Button>
                                </CardHeader>
                                <CardContent className="pt-8 flex-1">
                                    {isGenerating ? (
                                        <div className="flex flex-col items-center justify-center h-full space-y-8 min-h-[400px]">
                                            <div className="relative">
                                                <Loader2 className="w-16 h-16 text-primary animate-spin opacity-40" />
                                                <Zap className="w-6 h-6 text-yellow-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                                            </div>
                                            <p className="text-sm font-bold text-muted-foreground animate-pulse tracking-wide">Synthesizing macroeconomic dataset rationale...</p>
                                        </div>
                                    ) : rationale ? (
                                        <div className="prose prose-sm max-h-[550px] overflow-auto pr-4 scrollbar-thin">
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium text-foreground/70">{rationale}</p>
                                        </div>
                                    ) : (
                                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-4 border-dashed rounded-3xl bg-muted/5 opacity-50">
                                            <Database className="w-16 h-16 text-muted-foreground mb-6 opacity-20" />
                                            <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">Analytical Session Narrative Pending</p>
                                            <Button variant="ghost" size="sm" className="mt-6 font-bold" onClick={handleGenerateRationale}>
                                                Synthesize Metrics Now
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
