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
import { Calculator, ChevronRight, Zap, ArrowUp, ArrowDown, CheckCircle, Loader2, Info } from "lucide-react"
import { generateRatingRationale } from "@/ai/flows/generate-rating-rationale"
import { suggestFactSheetData } from "@/ai/flows/suggest-fact-sheet-data"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export default function RatingExecutionPage() {
    const { id } = useParams()
    const router = useRouter()
    const { toast } = useToast()
    
    const [country, setCountry] = useState<Country | null>(null)
    const [factSheet, setFactSheet] = useState<FactSheetData>({})
    const [models, setModels] = useState<RatingModel[]>([])
    const [scales, setScales] = useState<RatingScale[]>([])
    const [parameters, setParameters] = useState<Parameter[]>([])
    
    const [selectedModel, setSelectedModel] = useState<RatingModel | null>(null)
    const [selectedScale, setSelectedScale] = useState<RatingScale | null>(null)
    
    const [calculation, setCalculation] = useState<any>(null)
    const [isGenerating, setIsGenerating] = useState(false)
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
                    if (saved) setFactSheet(saved)
                }
                
                setModels(modelsData)
                setScales(scalesData)
                setParameters(paramsData)
                
                if (modelsData.length > 0) setSelectedModel(modelsData[0])
                if (scalesData.length > 0) setSelectedScale(scalesData[0])
            } catch (error) {
                console.error("Initialization error:", error)
                toast({ title: "Initialization Error", variant: "destructive", description: "Could not load rating parameters." })
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [id])

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
            Object.keys(suggested).forEach(key => {
                if ((suggested as any)[key] !== null) {
                    (merged as any)[key] = (suggested as any)[key]
                }
            })
            setFactSheet(merged)
            toast({ title: "Data Suggested", description: "Economic indicators have been updated based on AI market data." })
        } catch (e) {
            toast({ title: "AI Service Error", description: "Could not retrieve market data suggestions." })
        } finally {
            setIsGenerating(false)
        }
    }

    const handleGenerateRationale = async () => {
        if (!calculation || !country || !selectedModel || !selectedScale) return;
        setIsGenerating(true)
        try {
            const rationaleInput: any = {
                country,
                factSheetData: factSheet,
                model: {
                    ...selectedModel,
                    type: 'A',
                    weights: {
                        economic: selectedModel.weights['economic'] || 20,
                        fiscal: selectedModel.weights['fiscal'] || 20,
                        external: selectedModel.weights['external'] || 20,
                        monetary: selectedModel.weights['monetary'] || 20,
                        governance: selectedModel.weights['governance'] || 20,
                        eventRisk: selectedModel.weights['eventRisk'] || 0,
                    }
                },
                ratingScale: {
                    ...selectedScale,
                    type: 'standard'
                },
                derivedMetrics: calculation.derivedMetrics,
                transformedScores: calculation.transformedScores,
                weightedScores: calculation.weightedScores,
                finalScore: calculation.finalScore,
                initialRating: calculation.initialRating
            }
            
            const res = await generateRatingRationale(rationaleInput)
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
            adjustedRating: calculation.initialRating,
            approvalStatus: 'pending',
            reason: rationale
        })
        toast({ title: "Rating Saved", description: "The rating session has been archived for approval." })
        router.push('/')
    }

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>
    if (!country) return <div>Country not found.</div>

    const rawParameters = parameters.filter(p => p.type === 'raw');
    const derivedParameters = parameters.filter(p => p.type === 'derived');

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-primary">Execute Rating: {country.name}</h1>
                    <p className="text-muted-foreground mt-1">Sovereign Credit Workflow – Phase: <span className="capitalize text-foreground font-semibold">{step}</span></p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
                    {step === "input" && <Button onClick={handleRun} className="bg-primary"><Calculator className="w-4 h-4 mr-2" /> Run Analysis</Button>}
                    {step === "calculate" && <Button onClick={() => setStep("review")} className="bg-primary">Next: Final Review <ChevronRight className="w-4 h-4 ml-2" /></Button>}
                    {step === "review" && <Button onClick={handleFinalize} className="bg-green-600 hover:bg-green-700 text-white"><CheckCircle className="w-4 h-4 mr-2" /> Submit for Approval</Button>}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-3 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Model Configuration</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase">Analytical Model</label>
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
                                <label className="text-xs font-semibold text-muted-foreground uppercase">Rating Scale</label>
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
                                <CardTitle className="text-sm">Model Weights (%)</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {Object.entries(selectedModel.weights).map(([k, v]) => {
                                    const p = parameters.find(param => param.id === k)
                                    return (
                                        <div key={k} className="flex justify-between text-xs">
                                            <span className="capitalize">{p?.name || k}</span>
                                            <span className="font-bold">{v}%</span>
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
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Sovereign Fact Sheet</CardTitle>
                                    <CardDescription>Input raw economic data for the current reporting cycle.</CardDescription>
                                </div>
                                <Button size="sm" variant="outline" onClick={handleSuggest} disabled={isGenerating}>
                                    <Zap className="w-4 h-4 mr-2 text-yellow-500" /> {isGenerating ? "Consulting Markets..." : "Suggest via AI"}
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {rawParameters.map((p) => (
                                        <div key={p.id} className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">{p.name}</label>
                                            <Input 
                                                type="number" 
                                                value={factSheet[p.id] || 0} 
                                                onChange={e => setFactSheet({...factSheet, [p.id]: Number(e.target.value)})} 
                                                className="h-9"
                                            />
                                        </div>
                                    ))}
                                    {rawParameters.length === 0 && (
                                        <div className="col-span-full py-8 text-center border rounded border-dashed">
                                            <p className="text-sm text-muted-foreground">No raw parameters defined in Parameter Master.</p>
                                        </div>
                                    )}
                                </div>

                                {derivedParameters.length > 0 && (
                                    <div className="mt-8 pt-6 border-t">
                                        <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                                            Derived Parameters (Calculated on Run)
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger><Info className="w-3 h-3 text-muted-foreground" /></TooltipTrigger>
                                                    <TooltipContent>These values are automatically computed from your raw inputs using the defined formulas.</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {derivedParameters.map(p => (
                                                <div key={p.id} className="p-3 bg-muted/30 rounded border flex justify-between items-center">
                                                    <div>
                                                        <p className="text-xs font-semibold">{p.name}</p>
                                                        <p className="text-[10px] text-muted-foreground font-mono">{p.formula}</p>
                                                    </div>
                                                    <Badge variant="secondary">Derived</Badge>
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
                                    <CardDescription>Visualizing the path from raw/derived data to final credit score.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table className="financial-table border rounded-md overflow-hidden">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Pillar</TableHead>
                                                <TableHead>Value (Final)</TableHead>
                                                <TableHead>Transform Score (1-5)</TableHead>
                                                <TableHead>Weight</TableHead>
                                                <TableHead>Weighted Score</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {Object.keys(selectedModel.weights).map((pid) => {
                                                const p = parameters.find(param => param.id === pid)
                                                const isDerived = p?.type === 'derived';
                                                const val = isDerived ? calculation.derivedMetrics[pid] : factSheet[pid];
                                                
                                                return (
                                                    <TableRow key={pid}>
                                                        <TableCell className="font-semibold">
                                                            <div className="flex flex-col">
                                                                <span>{p?.name || pid}</span>
                                                                {isDerived && <span className="text-[10px] text-muted-foreground font-mono">{p?.formula}</span>}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className={isDerived ? "text-primary font-bold" : ""}>
                                                            {typeof val === 'number' ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : (val || 0)}
                                                        </TableCell>
                                                        <TableCell className="text-center font-bold">{calculation.transformedScores[pid]}</TableCell>
                                                        <TableCell>{selectedModel.weights[pid]}%</TableCell>
                                                        <TableCell className="text-right font-mono bg-muted/20">
                                                            {calculation.weightedScores[pid].toFixed(2)}
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                    <div className="mt-6 flex justify-end gap-12 items-center bg-primary p-6 rounded-lg text-primary-foreground shadow-inner">
                                        <div className="text-right">
                                            <p className="text-xs uppercase font-bold opacity-80">Final Quantitative Score</p>
                                            <p className="text-4xl font-extrabold">{calculation.finalScore.toFixed(1)}/100</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs uppercase font-bold opacity-80">Model-Suggested Rating</p>
                                            <p className="text-4xl font-extrabold">{calculation.initialRating}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {step === "review" && calculation && (
                        <div className="grid gap-6 md:grid-cols-2">
                            <Card className="md:col-span-1">
                                <CardHeader>
                                    <CardTitle>Rating Adjustment</CardTitle>
                                    <CardDescription>Qualitative adjustments based on current market signals.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex gap-4">
                                        <Button variant="outline" className="flex-1" onClick={() => setAdjustment(prev => prev + 1)}>
                                            <ArrowUp className="w-4 h-4 mr-2 text-green-500" /> Notch Upgrade
                                        </Button>
                                        <Button variant="outline" className="flex-1" onClick={() => setAdjustment(prev => prev - 1)}>
                                            <ArrowDown className="w-4 h-4 mr-2 text-red-500" /> Notch Downgrade
                                        </Button>
                                    </div>
                                    <div className="p-4 bg-muted/30 rounded border text-center">
                                        <p className="text-sm font-semibold">Current Adjustment: {adjustment > 0 ? `+${adjustment}` : adjustment} Notch(es)</p>
                                        <p className="text-xs text-muted-foreground mt-1">Adjusted Rating Target: <span className="text-foreground font-bold">{calculation.initialRating}</span></p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Adjustment Justification</label>
                                        <textarea className="w-full min-h-[100px] p-3 text-sm rounded-md border bg-background" placeholder="Describe factors for manual adjustment..." />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="md:col-span-1">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>AI Analytical Rationale</CardTitle>
                                        <CardDescription>Narrative justification for the rating session.</CardDescription>
                                    </div>
                                    <Button size="sm" variant="secondary" onClick={handleGenerateRationale} disabled={isGenerating}>
                                        <Zap className="w-4 h-4 mr-2" /> Generate
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    {isGenerating ? (
                                        <div className="flex flex-col items-center justify-center h-48 space-y-4">
                                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                            <p className="text-sm text-muted-foreground">Synthesizing macroeconomic data...</p>
                                        </div>
                                    ) : rationale ? (
                                        <div className="prose prose-sm max-h-[400px] overflow-auto pr-2">
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{rationale}</p>
                                        </div>
                                    ) : (
                                        <div className="h-48 flex items-center justify-center border-2 border-dashed rounded-lg">
                                            <p className="text-sm text-muted-foreground">No rationale generated yet.</p>
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
