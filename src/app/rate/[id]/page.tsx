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
import { generateRatingRationale } from "@/ai/flows/generate-rating-rationale"
import { suggestFactSheetData } from "@/ai/flows/suggest-fact-sheet-data"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// Enterprise Market Data Mock (Standardized Slugs)
const MOCK_MARKET_DATA: Record<string, Record<string, number>> = {
    "India": {
        "gdp": 3400000000000,
        "gdp_growth": 6.8,
        "inflation": 5.1,
        "fx_reserves": 640000000000,
        "debt": 2771000000000, // Roughly 81.5% of GDP
        "governance_score": 0.65,
        "political_stability": 0.55,
        "interest": 22000000000,
        "imports": 740000000000,
        "exports": 680000000000,
        "revenue": 590000000000,
        "external_debt": 620000000000,
        "debt_service": 45000000000
    },
    "USA": {
        "gdp": 27000000000000,
        "gdp_growth": 2.5,
        "inflation": 3.1,
        "fx_reserves": 240000000000,
        "debt": 33000000000000,
        "governance_score": 0.88,
        "political_stability": 0.75,
        "interest": 680000000000,
        "imports": 3600000000000,
        "exports": 2900000000000,
        "revenue": 5000000000000,
        "external_debt": 25000000000000,
        "debt_service": 900000000000
    },
    "Brazil": {
        "gdp": 2000000000000,
        "gdp_growth": 3.0,
        "inflation": 4.2,
        "fx_reserves": 350000000000,
        "debt": 1480000000000,
        "governance_score": 0.52,
        "political_stability": 0.45,
        "interest": 98000000000,
        "imports": 260000000000,
        "exports": 310000000000,
        "revenue": 330000000000,
        "external_debt": 680000000000,
        "debt_service": 80000000000
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
                let initialFactSheet: FactSheetData = {}
                let filled = new Set<string>()

                if (found) {
                    setCountry(found)
                    const saved = await getFactSheet(found.id)
                    if (saved) {
                        initialFactSheet = saved
                    } else {
                        const mockData = MOCK_MARKET_DATA[found.name]
                        if (mockData) {
                            paramsData.forEach(p => {
                                if (p.type === 'raw' && p.dataSource.includes('Auto')) {
                                    const val = mockData[p.slug]
                                    if (val !== undefined) {
                                        initialFactSheet[p.id] = val
                                        filled.add(p.id)
                                    }
                                }
                            }) 
                        }
                    }
                }
                
                setFactSheet(initialFactSheet)
                setAutoFilledFields(filled)
                setModels(modelsData)
                setScales(scalesData)
                setParameters(paramsData)
                
                if (modelsData.length > 0) setSelectedModel(modelsData[0])
                if (scalesData.length > 0) setSelectedScale(scalesData[0])
            } catch (error) {
                console.error("Analytical Initialization Error:", error)
            } finally {
                setLoading(false) 
            }
        }
        load()
    }, [id])

    // Live calculation of derived ratios for UI feedback during data entry
    const liveDerivedMetrics = useMemo(() => {
        if (!parameters.length) return {};
        const context: Record<string, number> = {}; 
        parameters.forEach(p => {
            if (p.type === 'raw') {
                const rawVal = factSheet[p.id];
                context[p.slug] = (rawVal !== undefined && rawVal !== null && rawVal !== "") ? Number(rawVal) : 0;
            }
        });
        
        const results: Record<string, number> = {};
        const derived = parameters.filter(p => p.type === 'derived');
        
        derived.forEach(p => {
            // Hardcoded failsafe for demo
            if (p.slug === 'debt_to_gdp') {
                const d = context['debt'] || 0;
                const g = context['gdp'] || 1;
                results[p.id] = (d / g) * 100;
            } else if (p.slug === 'reserve_cover') {
                const r = context['fx_reserves'] || 0;
                const i = context['imports'] || 12;
                results[p.id] = r / (i / 12);
            } else if (p.formula) {
                results[p.id] = evaluateFormula(p.formula, context);
            }
        });
        
        return results;
    }, [factSheet, parameters]); 

    const handleAutoFill = async () => {
        if (!country || !parameters.length) return
        setIsFetchingAuto(true)
        await new Promise(r => setTimeout(r, 600))
        const mockData = MOCK_MARKET_DATA[country.name]
        if (!mockData) {
            toast({ title: "Source Unavailable", description: `No market profile exists for ${country.name}.`, variant: "destructive" })
            setIsFetchingAuto(false)
            return
        }
        let syncCount = 0
        const updatedFilled = new Set(autoFilledFields)
        setFactSheet(prev => {
            const next = { ...prev };
            parameters.forEach(p => {
                if (p.type === 'raw' && p.dataSource.includes('Auto')) {
                    const val = mockData[p.slug]
                    if (val !== undefined) {
                        next[p.id] = val
                        updatedFilled.add(p.id)
                        syncCount++
                    }
                }
            })
            return next;
        })
        setAutoFilledFields(updatedFilled)
        toast({ title: "Market Data Sync", description: `Synchronized ${syncCount} macroeconomic parameters.` })
        setIsFetchingAuto(false)
    }

    const handleRun = () => {
        if (!selectedModel || !selectedScale) return
        
        const numericInputs: Record<string, number> = {};
        parameters.forEach(p => {
            const rawVal = factSheet[p.id];
            numericInputs[p.id] = (rawVal !== undefined && rawVal !== null && rawVal !== "") ? Number(rawVal) : 0;
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
                    const val = (suggested as any)[p.slug];
                    if (p.type === 'raw' && val !== undefined && val !== null) {
                        next[p.id] = val
                        filled.add(p.id)
                    }
                })
                return next;
            });
            setAutoFilledFields(filled)
            toast({ title: "AI Synthesis Complete", description: "Updated fact sheet with market-derived suggestions." })
        } catch (e) {
            toast({ title: "AI Error", variant: "destructive", description: "Failed to synthesize analytical data." })
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
            toast({ title: "Analytical Narrative Generation Error", variant: "destructive", description: "Failed to generate a rating narrative." })
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
        toast({ title: "Rating Saved" })
        router.push('/')
    }

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4"> 
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-primary">Execute Rating: {country?.name}</h1>
                    <p className="text-muted-foreground mt-1 text-lg">Current Stage: <span className="capitalize text-foreground font-semibold">{step}</span></p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.back()}>Abort</Button>
                    {step === "input" && <Button onClick={handleRun} className="bg-primary"><Calculator className="w-4 h-4 mr-2" /> Run Analysis</Button>}
                    {step === "calculate" && <Button onClick={() => setStep("review")} className="bg-primary">Move to Review <ChevronRight className="w-4 h-4 ml-2" /></Button>}
                    {step === "review" && <Button onClick={handleFinalize} className="bg-green-600 hover:bg-green-700 text-white"><CheckCircle className="w-4 h-4 mr-2" /> Submit for Approval</Button>}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-3 space-y-6">
                    <Card>
                        <CardHeader><CardTitle className="text-xs font-bold uppercase text-muted-foreground">Framework Settings</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold">Analytical Model</label>
                                <Select onValueChange={(v) => setSelectedModel(models.find(m => m.id === v)!)} value={selectedModel?.id}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{models.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold">Target Rating Scale</label>
                                <Select onValueChange={(v) => setSelectedScale(scales.find(s => s.id === v)!)} value={selectedScale?.id}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{scales.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-9">
                    {step === "input" && (
                        <Card>
                            <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-6">
                                <div><CardTitle>Country Fact Sheet</CardTitle></div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={handleAutoFill} disabled={isFetchingAuto}>
                                        <RefreshCw className={cn("w-3.5 h-3.5 mr-2", isFetchingAuto && "animate-spin")} /> Market Data Sync
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={handleSuggest} disabled={isGenerating}>
                                        <Zap className="w-3.5 h-3.5 mr-2 text-yellow-500" /> GenAI Synthesis
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {parameters.filter(p => p.type === 'raw').map((p) => (
                                        <div key={p.id} className="space-y-1.5">
                                            <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                                                <span>{p.name}</span>
                                                <span className="text-[9px] font-mono opacity-40 uppercase">{p.slug}</span>
                                            </label>
                                            <div className="relative">
                                                <Input 
                                                    type="number" 
                                                    value={factSheet[p.id] ?? ""} 
                                                    onChange={e => setFactSheet({...factSheet, [p.id]: e.target.value === "" ? "" : Number(e.target.value)})} 
                                                    className={cn(autoFilledFields.has(p.id) && "bg-green-50/40 border-green-200")} 
                                                />
                                                {autoFilledFields.has(p.id) && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-green-600 font-black">AUTO</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-12 pt-8 border-t">
                                    <h3 className="text-sm font-bold mb-6">Calculated Ratios & Logic</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {parameters.filter(p => p.type === 'derived').map(p => (
                                            <div key={p.id} className="p-4 bg-muted/10 rounded-lg border flex justify-between items-center">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold truncate">{p.name}</p>
                                                    <p className="text-[10px] text-muted-foreground font-mono">{p.formula || 'System Logic'}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-black text-primary font-mono">{(liveDerivedMetrics[p.id] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {step === "calculate" && calculation && (
                        <Card>
                            <CardHeader><CardTitle>Quantitative Scoring Breakdown</CardTitle></CardHeader>
                            <CardContent>
                                <Table className="border rounded-xl">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Analytical Factor</TableHead>
                                            <TableHead>Final Value</TableHead>
                                            <TableHead>Trans. Score</TableHead>
                                            <TableHead>Pillar Weight</TableHead>
                                            <TableHead className="text-right">Weighted Impact</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Object.keys(selectedModel?.weights || {}).map((pid) => {
                                            const p = parameters.find(param => param.id === pid)
                                            return (
                                                <TableRow key={pid}>
                                                    <TableCell><span className="font-bold text-sm">{p?.name || pid}</span></TableCell>
                                                    <TableCell className="font-mono">{(calculation.actualValuesUsed[pid] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                                                    <TableCell className="font-extrabold text-primary">{calculation.transformedScores[pid]}</TableCell>
                                                    <TableCell>{selectedModel?.weights[pid]}%</TableCell>
                                                    <TableCell className="text-right font-mono font-black">{(calculation.weightedScores[pid] || 0).toFixed(3)}</TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                                <div className="mt-8 grid grid-cols-2 gap-6">
                                    <div className="bg-primary text-white p-8 rounded-2xl">
                                        <p className="text-[10px] font-black uppercase opacity-80">Aggregate Risk Score</p>
                                        <div className="text-6xl font-black">{calculation.finalScore.toFixed(1)}%</div>
                                    </div>
                                    <div className="bg-white p-8 rounded-2xl border-4 border-primary/10">
                                        <p className="text-[10px] font-black uppercase text-primary opacity-80">Implied Credit Designation</p>
                                        <div className="text-6xl font-black text-primary">{calculation.initialRating}</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {step === "review" && calculation && (
                        <div className="grid gap-6 md:grid-cols-2">
                            <Card className="border-t-4 border-t-primary">
                                <CardHeader><CardTitle>AI Analytical Narrative</CardTitle></CardHeader>
                                <CardContent className="min-h-[300px]">
                                    {isGenerating ? <div className="flex flex-col items-center justify-center h-full"><Loader2 className="animate-spin" /></div> : rationale ? <p className="text-sm whitespace-pre-wrap">{rationale}</p> : <Button onClick={handleGenerateRationale}>Generate Rating Rationale</Button>}
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}