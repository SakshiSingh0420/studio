"use client"

import { useState, useEffect, use } from "react"
import { useParams, useRouter } from "next/navigation"
import { 
    getCountries, 
    getFactSheet, 
    saveFactSheet, 
    saveRating, 
    Country 
} from "@/lib/store"
import { 
    FactSheetData, 
    DEFAULT_MODELS, 
    DEFAULT_SCALES, 
    runRatingModel, 
    calculateDerivedMetrics,
    RatingModel,
    RatingScale
} from "@/lib/rating-engine"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calculator, Save, FileText, ChevronRight, Zap, ArrowUp, ArrowDown, CheckCircle } from "lucide-react"
import { generateRatingRationale } from "@/ai/flows/generate-rating-rationale"
import { suggestFactSheetData } from "@/ai/flows/suggest-fact-sheet-data"

const DEFAULT_FACT_SHEET: FactSheetData = {
    gdp: 500000000000,
    gdpGrowth: 3.5,
    inflation: 2.1,
    debt: 200000000000,
    revenue: 100000000000,
    interest: 5000000000,
    fxReserves: 40000000000,
    imports: 80000000000,
    exports: 75000000000,
    externalDebt: 50000000000,
    debtService: 4000000000,
    npl: 4.5,
    car: 12.0,
    governanceScore: 65,
    politicalStability: 70,
    climateRisk: 30,
    defaultHistory: false
}

export default function RatingExecutionPage() {
    const { id } = useParams()
    const router = useRouter()
    const { toast } = useToast()
    const [country, setCountry] = useState<Country | null>(null)
    const [factSheet, setFactSheet] = useState<FactSheetData>(DEFAULT_FACT_SHEET)
    const [selectedModel, setSelectedModel] = useState<RatingModel>(DEFAULT_MODELS[0])
    const [selectedScale, setSelectedScale] = useState<RatingScale>(DEFAULT_SCALES[0])
    const [calculation, setCalculation] = useState<any>(null)
    const [isGenerating, setIsGenerating] = useState(false)
    const [rationale, setRationale] = useState("")
    const [adjustment, setAdjustment] = useState<number>(0)
    const [step, setStep] = useState<"input" | "calculate" | "review">("input")

    useEffect(() => {
        async function load() {
            const countries = await getCountries()
            const found = countries.find(c => c.id === id)
            if (found) {
                setCountry(found)
                const saved = await getFactSheet(found.id)
                if (saved) setFactSheet(saved)
            }
        }
        load()
    }, [id])

    const handleRun = () => {
        const result = runRatingModel(factSheet, selectedModel, selectedScale)
        setCalculation(result)
        setStep("calculate")
    }

    const handleSuggest = async () => {
        if (!country) return;
        setIsGenerating(true)
        try {
            const suggested = await suggestFactSheetData({ countryName: country.name })
            // suggested comes back with nulls often, merge carefully
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
        if (!calculation || !country) return;
        setIsGenerating(true)
        try {
            const res = await generateRatingRationale({
                country,
                factSheetData: factSheet,
                model: selectedModel,
                ratingScale: selectedScale,
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
        if (!calculation || !country) return;
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
            adjustedRating: adjustment !== 0 ? calculation.initialRating : undefined, // Simplified for demo
            approvalStatus: 'pending',
            reason: rationale
        })
        toast({ title: "Rating Saved", description: "The rating session has been archived for approval." })
        router.push('/')
    }

    if (!country) return <div>Loading...</div>

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
                                <Select onValueChange={(v) => setSelectedModel(DEFAULT_MODELS.find(m => m.id === v)!)} defaultValue={selectedModel.id}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DEFAULT_MODELS.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase">Rating Scale</label>
                                <Select onValueChange={(v) => setSelectedScale(DEFAULT_SCALES.find(s => s.id === v)!)} defaultValue={selectedScale.id}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Scale" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DEFAULT_SCALES.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Model Weights (%)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {Object.entries(selectedModel.weights).map(([k, v]) => (
                                <div key={k} className="flex justify-between text-xs">
                                    <span className="capitalize">{k}</span>
                                    <span className="font-bold">{v}%</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
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
                                    {Object.entries(factSheet).map(([key, value]) => (
                                        typeof value === 'number' && (
                                            <div key={key} className="space-y-1">
                                                <label className="text-xs font-medium text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                                                <Input 
                                                    type="number" 
                                                    value={value} 
                                                    onChange={e => setFactSheet({...factSheet, [key]: Number(e.target.value)})} 
                                                    className="h-9"
                                                />
                                            </div>
                                        )
                                    ))}
                                    <div className="flex items-center gap-2 pt-6">
                                        <input 
                                            type="checkbox" 
                                            checked={factSheet.defaultHistory} 
                                            onChange={e => setFactSheet({...factSheet, defaultHistory: e.target.checked})}
                                            className="w-4 h-4"
                                        />
                                        <label className="text-xs font-medium">History of Default</label>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {step === "calculate" && calculation && (
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Analytical Breakdown</CardTitle>
                                    <CardDescription>Visualizing the path from raw data to final credit score.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table className="financial-table border rounded-md overflow-hidden">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Pillar</TableHead>
                                                <TableHead>Raw (Main Metric)</TableHead>
                                                <TableHead>Derived Result</TableHead>
                                                <TableHead>Transform Score (1-5)</TableHead>
                                                <TableHead>Weight</TableHead>
                                                <TableHead>Weighted Score</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {[
                                                { label: 'Economic Growth', key: 'economic', raw: factSheet.gdpGrowth + '%', derived: 'N/A' },
                                                { label: 'Fiscal Health', key: 'fiscal', raw: '$' + (factSheet.debt / 1e9).toFixed(1) + 'B Debt', derived: (calculation.derivedMetrics.debtToGDP * 100).toFixed(1) + '% Debt/GDP' },
                                                { label: 'External Stability', key: 'external', raw: '$' + (factSheet.fxReserves / 1e9).toFixed(1) + 'B Reserves', derived: calculation.derivedMetrics.reserveCover.toFixed(2) + 'x Imports' },
                                                { label: 'Monetary Control', key: 'monetary', raw: factSheet.inflation + '% Inflation', derived: 'N/A' },
                                                { label: 'Governance Index', key: 'governance', raw: factSheet.governanceScore, derived: 'N/A' },
                                                { label: 'Event / Default Risk', key: 'eventRisk', raw: factSheet.defaultHistory ? 'Yes' : 'No', derived: 'N/A' },
                                            ].map((row) => (
                                                <TableRow key={row.key}>
                                                    <TableCell className="font-semibold">{row.label}</TableCell>
                                                    <TableCell>{row.raw}</TableCell>
                                                    <TableCell>{row.derived}</TableCell>
                                                    <TableCell className="text-center font-bold">{calculation.transformedScores[row.key]}</TableCell>
                                                    <TableCell>{(selectedModel.weights as any)[row.key]}%</TableCell>
                                                    <TableCell className="text-right font-mono bg-muted/20">
                                                        {calculation.weightedScores[row.key].toFixed(2)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
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
                                        <textarea className="w-full min-h-[100px] p-3 text-sm rounded-md border bg-background" placeholder="Describe clinical or geopolitical factors for manual adjustment..." />
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