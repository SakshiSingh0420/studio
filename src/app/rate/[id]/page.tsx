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
        parameters.forEach(p => {
            if (p.type === 'raw') {
                const rawVal = factSheet[p.id];
                // Safety check for p.slug to avoid toLowerCase() error
                const slugSource = p.slug || p.id || "";
                const normalizedSlug = slugSource.toLowerCase().replace(/-/g, '_');
                if (normalizedSlug) {
                    context[normalizedSlug] = (rawVal !== undefined && rawVal !== null && rawVal !== "") ? Number(rawVal) : 0;
                }
            }
        });
        
        const results: Record<string, number> = {};
        parameters.filter(p => p.type === 'derived').forEach(p => {
            const slugSource = p.slug || p.id || "";
            const normalizedTarget = slugSource.toLowerCase().replace(/-/g, '_');
            
            if (normalizedTarget === 'debt_to_gdp') {
                const debt = context['government_debt'] || context['debt'] || context['total_debt'] || 0;
                const gdp = context['gdp'] || 1;
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
            numericInputs[p.id] = (rawVal !== undefined && rawVal !== null && rawVal !== "") ? Number(rawVal) : 0;
        });

        // Trigger dynamic rating calculation
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
                    <h1 className="text-3xl font-bold tracking-tight text-primary">Execution: {country?.name}</h1>
                    <p className="text-muted-foreground mt-1 capitalize font-medium">{step} Phase</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
                    {step === "input" && <Button onClick={handleRun} className="bg-primary"><Calculator className="w-4 h-4 mr-2" /> Run Analysis</Button>}
                    {step === "calculate" && <Button onClick={() => setStep("review")} className="bg-primary">Continue to Review <ChevronRight className="w-4 h-4 ml-2" /></Button>}
                    {step === "review" && <Button onClick={handleFinalize} className="bg-green-600 hover:bg-green-700 text-white"><CheckCircle className="w-4 h-4 mr-2" /> Finalize Rating</Button>}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-3">
                    <Card>
                        <CardHeader><CardTitle className="text-xs font-bold uppercase text-muted-foreground">Framework</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold">Analytical Model</label>
                                <Select onValueChange={(v) => setSelectedModel(models.find(m => m.id === v)!)} value={selectedModel?.id}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{models.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold">Rating Scale</label>
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
                            <CardHeader className="flex flex-row items-center justify-between border-b pb-6">
                                <CardTitle>Country Fact Sheet</CardTitle>
                                <Button size="sm" variant="outline" onClick={handleSuggest} disabled={isGenerating}>
                                    <Zap className="w-3.5 h-3.5 mr-2 text-yellow-500" /> GenAI Synthesis
                                </Button>
                            </CardHeader>
                            <CardContent className="pt-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {parameters.filter(p => p.type === 'raw').map((p) => (
                                        <div key={p.id} className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase">{p.name}</label>
                                            <div className="relative">
                                                <Input 
                                                    type="number" 
                                                    value={factSheet[p.id] ?? ""} 
                                                    onChange={e => setFactSheet({...factSheet, [p.id]: e.target.value === "" ? "" : Number(e.target.value)})} 
                                                    className={cn(autoFilledFields.has(p.id) && "bg-green-50 border-green-200")} 
                                                />
                                                {autoFilledFields.has(p.id) && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-green-600 font-bold">AI</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-12 pt-8 border-t">
                                    <h3 className="text-sm font-bold mb-4">Live Analytical Ratios</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {parameters.filter(p => p.type === 'derived').map(p => (
                                            <div key={p.id} className="p-4 bg-muted/20 rounded-lg border flex justify-between items-center">
                                                <div>
                                                    <p className="text-xs font-bold">{p.name}</p>
                                                    <p className="text-[9px] text-muted-foreground">{p.slug || p.id}</p>
                                                </div>
                                                <p className="text-sm font-black text-primary">{(liveDerivedMetrics[p.id] ?? 0).toFixed(2)}</p>
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
                                <Table className="border rounded-lg overflow-hidden">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Analytical Parameter</TableHead>
                                            <TableHead>Final Value</TableHead>
                                            <TableHead>Trans. Score</TableHead>
                                            <TableHead>Weight</TableHead>
                                            <TableHead className="text-right">Impact</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Object.keys(selectedModel?.weights || {}).map((pid) => {
                                            const p = parameters.find(param => param.id === pid)
                                            const val = calculation.actualValuesUsed[pid] ?? 0;
                                            return (
                                                <TableRow key={pid}>
                                                    <TableCell className="font-bold">{p?.name || pid}</TableCell>
                                                    <TableCell className="font-mono text-primary font-bold">
                                                        {val.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="font-bold">{calculation.transformedScores[pid]}</TableCell>
                                                    <TableCell>{selectedModel?.weights[pid]}%</TableCell>
                                                    <TableCell className="text-right font-mono font-bold">{(calculation.weightedScores[pid] || 0).toFixed(3)}</TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-primary text-white p-8 rounded-xl">
                                        <p className="text-[10px] font-bold uppercase opacity-80">Aggregate Risk Score</p>
                                        <div className="text-5xl font-black">{calculation.finalScore.toFixed(1)}%</div>
                                    </div>
                                    <div className="bg-white p-8 rounded-xl border-4 border-primary/10">
                                        <p className="text-[10px] font-bold uppercase text-primary opacity-80">Implied Rating</p>
                                        <div className="text-5xl font-black text-primary">{calculation.initialRating}</div>
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
