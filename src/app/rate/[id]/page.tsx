
"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { 
    getCountries, 
    getFactSheet, 
    saveFactSheet, 
    saveRating, 
    getModels,
    getScales,
    getParameters,
    Country,
    getRatingHistory,
    saveReport
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
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calculator, ChevronRight, Zap, CheckCircle, Loader2, Settings2, ArrowDownNarrowWide, ArrowUpNarrowWide, Sparkles, FileText, ArrowLeft, Globe, FileOutput } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { generateRatingRationale } from "@/ai/flows/generate-rating-rationale"

const DEMO_COUNTRIES: Partial<Country>[] = [
  { id: 'demo-in', name: "India", region: "Asia", incomeGroup: "Emerging", currency: "INR", gdpSnapshot: 3400, year: 2025 },
  { id: 'demo-us', name: "United States", region: "North America", incomeGroup: "Advanced", currency: "USD", gdpSnapshot: 26000, year: 2026 },
  { id: 'demo-cn', name: "China", region: "Asia", incomeGroup: "Emerging", currency: "CNY", gdpSnapshot: 18000, year: 2026 },
  { id: 'demo-de', name: "Germany", region: "Europe", incomeGroup: "Advanced", currency: "EUR", gdpSnapshot: 4500, year: 2026 },
  { id: 'demo-br', name: "Brazil", region: "South America", incomeGroup: "Emerging", currency: "BRL", gdpSnapshot: 2100, year: 2026 },
  { id: 'demo-za', name: "South Africa", region: "Africa", incomeGroup: "Emerging", currency: "ZAR", gdpSnapshot: 400, year: 2026 },
];

const STATIC_DATASETS: Record<string, Record<string, number>> = {
  "India": {
    gdp_nominal: 3400,
    government_debt: 3000,
    government_revenue: 700,
    fx_reserves: 600,
    imports: 700,
    exports: 670,
    inflation: 5.5,
    inflation_volatility: 2.5,
    gdp_growth: 6.5,
    fiscal_balance: -6,
    interest_payments: 200,
    governance_score: 0.6,
    political_stability: 0.5,
    social_risk: 0.5,
    climate_risk: 0.4,
    exchange_rate_volatility: 3,
    gdp_per_capita: 2400
  },
  "United States": {
    gdp_nominal: 26000,
    government_debt: 34000,
    government_revenue: 8000,
    fx_reserves: 250,
    imports: 3200,
    exports: 2500,
    inflation: 3.2,
    inflation_volatility: 1.5,
    gdp_growth: 2.0,
    fiscal_balance: -5,
    interest_payments: 900,
    governance_score: 0.9,
    political_stability: 0.8,
    social_risk: 0.3,
    climate_risk: 0.5,
    exchange_rate_volatility: 1.2,
    gdp_per_capita: 65000
  },
  "China": {
    gdp_nominal: 18000,
    government_debt: 14000,
    government_revenue: 5000,
    fx_reserves: 3200,
    imports: 2700,
    exports: 3400,
    inflation: 2.0,
    inflation_volatility: 1.2,
    gdp_growth: 5.0,
    fiscal_balance: -4,
    interest_payments: 500,
    governance_score: 0.7,
    political_stability: 0.6,
    social_risk: 0.4,
    climate_risk: 0.5,
    exchange_rate_volatility: 2,
    gdp_per_capita: 12000
  },
  "Germany": {
    gdp_nominal: 4500,
    government_debt: 3000,
    government_revenue: 1500,
    fx_reserves: 300,
    imports: 1500,
    exports: 1800,
    inflation: 2.5,
    inflation_volatility: 1.0,
    gdp_growth: 1.5,
    fiscal_balance: -2,
    interest_payments: 150,
    governance_score: 0.9,
    political_stability: 0.9,
    social_risk: 0.2,
    climate_risk: 0.4,
    exchange_rate_volatility: 1.0,
    gdp_per_capita: 50000
  },
  "Brazil": {
    gdp_nominal: 2100,
    government_debt: 1600,
    government_revenue: 600,
    fx_reserves: 350,
    imports: 300,
    exports: 280,
    inflation: 4.5,
    inflation_volatility: 2.2,
    gdp_growth: 2.5,
    fiscal_balance: -6,
    interest_payments: 120,
    governance_score: 0.5,
    political_stability: 0.4,
    social_risk: 0.6,
    climate_risk: 0.6,
    exchange_rate_volatility: 3.5,
    gdp_per_capita: 9000
  },
  "South Africa": {
    gdp_nominal: 400,
    government_debt: 300,
    government_revenue: 120,
    fx_reserves: 60,
    imports: 100,
    exports: 90,
    inflation: 5.0,
    inflation_volatility: 3.0,
    gdp_growth: 1.2,
    fiscal_balance: -5,
    interest_payments: 30,
    governance_score: 0.5,
    political_stability: 0.4,
    social_risk: 0.7,
    climate_risk: 0.7,
    exchange_rate_volatility: 4,
    gdp_per_capita: 6000
  }
};

export default function RatingExecutionPage() {
    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()
    const { toast } = useToast()
    
    // Robust ID extraction for App Router
    const rawId = params?.id
    const id = useMemo(() => {
        if (!rawId) return null;
        return Array.isArray(rawId) ? rawId[0] : rawId;
    }, [rawId]);

    const [country, setCountry] = useState<Country | null>(null)
    const [factSheet, setFactSheet] = useState<FactSheetData>({})
    const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set())
    const [models, setModels] = useState<RatingModel[]>([])
    const [scales, setScales] = useState<RatingScale[]>([])
    const [parameters, setParameters] = useState<Parameter[]>([])
    
    const [selectedModel, setSelectedModel] = useState<RatingModel | null>(null)
    const [selectedScale, setSelectedScale] = useState<RatingScale | null>(null)
    const [executionYear, setExecutionYear] = useState<number>(2025)
    
    const [calculation, setCalculation] = useState<any>(null)
    const [isGenerating, setIsGenerating] = useState(false)
    const [isGeneratingRationale, setIsGeneratingRationale] = useState(false)
    const [rationale, setRationale] = useState("")
    const [step, setStep] = useState<"input" | "calculate" | "review">("input")
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            if (!id) return;
            try {
                const [dbCountries, modelsData, scalesData, paramsData] = await Promise.all([
                    getCountries(),
                    getModels(),
                    getScales(),
                    getParameters()
                ])
                
                const allCountries = [
                    ...dbCountries,
                    ...DEMO_COUNTRIES.filter(d => !dbCountries.some(c => c.name.toLowerCase() === d.name?.toLowerCase()))
                ] as Country[];

                const found = allCountries.find(c => String(c.id) === String(id))
                if (found) {
                    setCountry(found)
                }
                
                setModels(modelsData)
                setScales(scalesData)
                setParameters(paramsData)
                
                const mId = searchParams.get('model')
                const sId = searchParams.get('scale')
                const yearStr = searchParams.get('year')
                
                if (yearStr) setExecutionYear(Number(yearStr))
                
                const initialModel = mId ? modelsData.find(m => m.id === mId) : modelsData.find(m => m.isDefault && m.isActive) || modelsData[0]
                const initialScale = sId ? scalesData.find(s => s.id === sId) : scalesData[0]
                
                if (initialModel) setSelectedModel(initialModel)
                if (initialScale) setSelectedScale(initialScale)
            } catch (error) {
                console.error("Initialization Error:", error)
            } finally {
                setLoading(false) 
            }
        }
        load()
    }, [id, searchParams])

    const liveDerivedMetrics = useMemo(() => {
        if (!parameters.length) return {};
        
        const context: Record<string, number> = {}; 
        
        parameters.forEach(p => {
            const rawVal = factSheet[p.id];
            const val = (rawVal !== undefined && rawVal !== null && rawVal !== "") ? Number(rawVal) : 0;
            
            context[p.id] = val;
            if (p.slug) context[p.slug.toLowerCase()] = val;
            if (p.name) context[p.name.toLowerCase()] = val;
        });
        
        const results: Record<string, number> = {};

        parameters.filter(p => p.type === 'derived').forEach(p => {
            const slug = (p.slug || "").toLowerCase();
            const name = (p.name || "").toLowerCase();
            
            let resultValue = 0;

            if (slug.includes('debt_to_gdp') || name.includes('debt_to_gdp')) {
                const debt = context['government_debt'] || context['debt'] || context['total_debt'] || context['governmentdebt'] || 0;
                const gdp = context['gdp_nominal'] || context['gdp'] || context['nominal_gdp'] || 1;
                resultValue = (debt / (gdp || 1)) * 100;
            } else if (slug.includes('reserve_cover') || name.includes('reserve_cover')) {
                const res = context['fx_reserves'] || context['reserves'] || context['fxreserves'] || 0;
                const imp = context['imports'] || 1;
                resultValue = res / (imp || 1);
            } else if (slug.includes('interest_to_revenue') || name.includes('interest_to_revenue')) {
                const int = context['interest_payments'] || context['interest'] || context['interestpayments'] || 0;
                const rev = context['government_revenue'] || context['revenue'] || context['governmentrevenue'] || 1;
                resultValue = (int / (rev || 1)) * 100;
            } else if (p.formula) {
                resultValue = evaluateFormula(p.formula, context);
            }

            results[p.id] = resultValue;
            context[p.id] = resultValue;
            if (p.slug) context[p.slug.toLowerCase()] = resultValue;
        });
        
        return results;
    }, [factSheet, parameters]);

    const handleRun = () => {
        if (!selectedModel || !selectedScale || !parameters.length) return
        
        const numericInputs: Record<string, number> = {};
        parameters.forEach(p => {
            const rawVal = factSheet[p.id];
            const val = (rawVal !== undefined && rawVal !== null && rawVal !== "") ? Number(rawVal) : 0;
            numericInputs[p.id] = val;
        });

        const result = runDynamicRating(numericInputs, selectedModel, selectedScale, parameters); 
        setCalculation(result)
        setStep("calculate")
        
        toast({ title: "Analysis Finalized", description: `Aggregate Score: ${result.finalScore.toFixed(1)}%` })
    }
    const handleAutoFetch = () => {
        if (!country) {
            toast({ title: "No country selected", variant: "destructive" });
            return;
        }
    
        if (!parameters.length) {
            toast({
                variant: "destructive",
                title: "Parameters not loaded",
                description: "Cannot auto fetch without parameters."
            });
            return;
        }
    
        setIsGenerating(true);
    
        const countryKey = Object.keys(STATIC_DATASETS).find(
            key => key.toLowerCase() === country.name.toLowerCase()
        );
    
        const benchmarkData = countryKey ? STATIC_DATASETS[countryKey] : null;
    
        if (!benchmarkData) {
            toast({
                variant: "destructive",
                title: "No Benchmark Data",
                description: `Static dataset not found for ${country.name}.`
            });
            setIsGenerating(false);
            return;
        }
    
        const FIELD_MAP: Record<string, string> = {
            // GDP
            gdp: "gdp_nominal",
            gdp_nominal: "gdp_nominal",
            nominal_gdp: "gdp_nominal",
    
            // Debt
            government_debt: "government_debt",
            debt: "government_debt",
            total_debt: "government_debt",
            gov_debt: "government_debt",
    
            // Revenue
            government_revenue: "government_revenue",
            revenue: "government_revenue",
            gov_revenue: "government_revenue",
    
            // Reserves
            fx_reserves: "fx_reserves",
            reserves: "fx_reserves",
            foreign_reserves: "fx_reserves",
    
            // Interest
            interest_payments: "interest_payments",
            interest: "interest_payments",
    
            // Growth
            gdp_growth: "gdp_growth",
            growth: "gdp_growth",
    
            // Others
            imports: "imports",
            exports: "exports",
            inflation: "inflation",
            inflation_volatility: "inflation_volatility",
            fiscal_balance: "fiscal_balance",
            governance_score: "governance_score",
            political_stability: "political_stability",
            social_risk: "social_risk",
            climate_risk: "climate_risk",
            exchange_rate_volatility: "exchange_rate_volatility",
            gdp_per_capita: "gdp_per_capita"
        };
    
        const nextFactSheet: FactSheetData = {};
        const filled = new Set<string>();
    
        parameters.forEach(p => {
            if ((p.type || "").toLowerCase() === "derived") return;
    
            const slug = (p.slug || "").toLowerCase();
    
            const name = (p.name || "")
                .toLowerCase()
                .replace(/\s+/g, "_")
                .replace(/[^\w]/g, "");
    
            const id = p.id.toLowerCase();
    
            const key =
                FIELD_MAP[slug] ||
                FIELD_MAP[name] ||
                FIELD_MAP[id];
            
            console.log("MAPPING CHECK", {
              paramId: p.id,
              slug,
              name,
              mappedKey: key,
              value: key ? benchmarkData[key] : undefined
            });
    
            if (key && benchmarkData[key] !== undefined) {
                nextFactSheet[p.id] = benchmarkData[key];
                filled.add(p.id);
            }
        });
    
        setFactSheet({ ...nextFactSheet });
        setAutoFilledFields(filled);
        setIsGenerating(false);
    
        toast({
            title: "Sovereign Benchmarks Loaded",
            description: `Analytical profile for ${country.name} synchronized.`
        });
    };

    useEffect(() => {
        if (step === "review" && calculation && country && selectedModel && selectedScale && !rationale) {
            const generate = async () => {
                setIsGeneratingRationale(true);
                try {
                    const res = await generateRatingRationale({
                        country: { 
                            id: country.id, 
                            name: country.name, 
                            region: country.region, 
                            incomeGroup: country.incomeGroup,
                            currency: country.currency,
                            population: country.population,
                            gdp: country.nominalGdp
                        },
                        factSheetData: factSheet as any,
                        model: { id: selectedModel.id, name: selectedModel.name, weights: selectedModel.weights },
                        ratingScale: { id: selectedScale.id, name: selectedScale.name, mapping: selectedScale.mapping },
                        derivedMetrics: liveDerivedMetrics as any,
                        transformedScores: calculation.transformedScores,
                        weightedScores: calculation.weightedScores,
                        finalScore: calculation.finalScore,
                        initialRating: calculation.initialRating
                    });
                    setRationale(res.rationale);
                } catch (error) {
                    console.error("AI Generation Error:", error);
                    toast({ variant: "destructive", title: "AI Generation Failed", description: "Could not generate analytical narrative." });
                } finally {
                    setIsGeneratingRationale(false);
                }
            };
            generate();
        }
    }, [step, calculation, country, selectedModel, selectedScale, factSheet, liveDerivedMetrics, rationale, toast]);

    const handleFinalize = async () => {
        if (!calculation || !country || !selectedModel || !selectedScale) return;
        
        // 1. Versioning Logic
        const history = await getRatingHistory(country.id);
        const nextVersion = history.length > 0
          ? Math.max(...history.map(r => r.version || 1)) + 1
          : 1;

        const breakdown = Object.keys(selectedModel.weights).map(pid => {
            const p = parameters.find(param => param.id === pid);
            return {
                id: pid,
                name: p?.name || pid,
                category: p?.category || 'Economic',
                actualValue: calculation.actualValuesUsed[pid],
                score: calculation.transformedScores[pid],
                weight: selectedModel.weights[pid],
                impact: calculation.weightedScores[pid]
            };
        });

        await saveFactSheet(country.id, factSheet)
        await saveRating({
            countryId: country.id,
            modelId: selectedModel.id,
            scaleId: selectedScale.id,
            year: executionYear,
            finalScore: calculation.finalScore,
            initialRating: calculation.initialRating,
            approvalStatus: 'pending',
            reason: rationale,
            version: nextVersion,
            snapshot: {
              factSheet,
              derivedMetrics: liveDerivedMetrics,
              finalScore: calculation.finalScore,
              rating: calculation.initialRating,
              breakdown,
              parameterBreakdown: Object.keys(selectedModel.weights).map(pid => ({
                parameterId: pid,
                name: parameters.find(p => p.id === pid)?.name || pid,
                value: calculation.actualValuesUsed?.[pid] ?? null,
                score: calculation.transformedScores?.[pid] ?? null,
                weight: selectedModel.weights?.[pid] ?? null,
                impact: calculation.weightedScores?.[pid] ?? null
              }))
            }
        })
        toast({ title: "Rating Session Finalized", description: `Rating for ${country.name} (${executionYear}) has been submitted for approval.` })
        router.push('/')
    }

    const handleGenerateReport = async () => {
        if (!calculation || !country || !selectedModel || !selectedScale) return;
        
        setIsGenerating(true);
        try {
            // Get history to determine change
            const history = await getRatingHistory(country.id);
            const prev = history.length > 0 ? history[0].initialRating : undefined;
            const nextVersion = history.length > 0
              ? Math.max(...history.map(r => r.version || 1)) + 1
              : 1;
            
            let change: 'Upgrade' | 'Downgrade' | 'Stable' = 'Stable';
            if (prev && prev !== calculation.initialRating) {
                // Simplified comparison
                change = calculation.finalScore > (history[0].finalScore || 0) ? 'Upgrade' : 'Downgrade';
            }

            const highStrengths = Object.entries(calculation.transformedScores)
                .filter(([_, s]: any) => s >= 4)
                .map(([pid]) => parameters.find(p => p.id === pid)?.name || pid);
            
            const lowRisks = Object.entries(calculation.transformedScores)
                .filter(([_, s]: any) => s <= 2)
                .map(([pid]) => parameters.find(p => p.id === pid)?.name || pid);

            const deterministicRationale = `The sovereign credit profile of ${country.name} is primarily supported by its strong performance in ${highStrengths.length > 0 ? highStrengths.join(', ') : 'core fundamental indicators'}. However, the rating is tempered by risks associated with ${lowRisks.length > 0 ? lowRisks.join(', ') : 'ongoing global and internal macroeconomic volatility'}.`;

            const growth = liveDerivedMetrics['gdp_growth'] || factSheet['gdp_growth'] || 0;
            const debtGdp = liveDerivedMetrics['debt_to_gdp'] || 0;

            const deterministicSummary = `${country.name} exhibits ${growth > 5 ? 'robust' : growth > 2 ? 'moderate' : 'subdued'} economic growth of ${growth.toFixed(1)}%. The government's debt-to-GDP ratio of ${debtGdp.toFixed(1)}% indicates a ${debtGdp > 80 ? 'high' : debtGdp > 40 ? 'moderate' : 'low'} leverage profile. Overall, the analytical framework suggests a ${calculation.finalScore > 70 ? 'strong' : calculation.finalScore > 40 ? 'stable' : 'vulnerable'} credit position for the ${executionYear} cycle.`;

            const breakdown = Object.keys(selectedModel.weights).map(pid => {
                const p = parameters.find(param => param.id === pid);
                return {
                    id: pid,
                    name: p?.name || pid,
                    category: p?.category || 'Economic',
                    actualValue: calculation.actualValuesUsed[pid],
                    score: calculation.transformedScores[pid],
                    weight: selectedModel.weights[pid],
                    impact: calculation.weightedScores[pid]
                };
            });

            const reportData = {
                countryId: country.id,
                countryName: country.name,
                region: country.region,
                modelId: selectedModel.id,
                modelName: selectedModel.name,
                modelVersion: selectedModel.version,
                scaleId: selectedScale.id,
                scaleName: selectedScale.name,
                year: executionYear,
                finalScore: calculation.finalScore,
                rating: calculation.initialRating,
                outlook: 'Stable',
                status: 'Pending',
                metrics: {
                    gdp: factSheet['gdp_nominal'] || 0,
                    gdpGrowth: growth,
                    debtToGdp: debtGdp,
                    inflation: factSheet['inflation'] || 0,
                    fiscalBalance: factSheet['fiscal_balance'] || 0,
                    fxReserves: factSheet['fx_reserves'] || 0
                },
                breakdown,
                rationale: rationale || deterministicRationale,
                summary: deterministicSummary,
                previousRating: prev,
                ratingChange: change,
                dataSource: 'IMF / World Bank / Internal Registry'
            };

            const reportRef = await saveReport(reportData);
            
            // Also save the rating to history
            await saveRating({
                countryId: country.id,
                modelId: selectedModel.id,
                scaleId: selectedScale.id,
                year: executionYear,
                finalScore: calculation.finalScore,
                initialRating: calculation.initialRating,
                approvalStatus: 'pending',
                reason: rationale || deterministicRationale,
                version: nextVersion,
                snapshot: {
                  factSheet,
                  derivedMetrics: liveDerivedMetrics,
                  finalScore: calculation.finalScore,
                  rating: calculation.initialRating,
                  breakdown,
                  parameterBreakdown: breakdown.map(b => ({
                    parameterId: b.id,
                    name: b.name,
                    value: b.actualValue,
                    score: b.score,
                    weight: b.weight,
                    impact: b.impact
                  }))
                }
            });

            toast({ title: "Report Generated", description: "Sovereign report has been archived and finalized." });
            router.push(`/reports/${reportRef.id}`);
        } catch (e) {
            toast({ variant: "destructive", title: "Report Error", description: "Failed to generate structured report document." });
        } finally {
            setIsGenerating(false);
        }
    }

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>

    if (!country) return (
        <div className="flex flex-col h-[80vh] items-center justify-center space-y-4">
            <Globe className="w-12 h-12 text-muted-foreground opacity-20" />
            <p className="text-muted-foreground font-bold">Sovereign profile not found.</p>
            <Button onClick={() => router.push('/countries')}>Return to Registry</Button>
        </div>
    )

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4"> 
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-slate-900">Execution: {country?.name}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-primary/10 text-primary border-primary/20">{executionYear} Cycle</Badge>
                        <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">{country?.region}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {step !== "review" && (
                        <Button variant="outline" onClick={() => router.push(`/countries`)} className="font-semibold">Cancel</Button>
                    )}
                    {step === "review" && (
                        <Button variant="outline" onClick={() => setStep("calculate")} className="font-semibold">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Calculation
                        </Button>
                    )}
                    {step === "input" && <Button onClick={handleRun} className="bg-primary font-bold shadow-md hover:shadow-lg transition-all"><Calculator className="w-4 h-4 mr-2" /> Run Analysis</Button>}
                    {step === "calculate" && <Button onClick={() => setStep("review")} className="bg-primary font-bold">Continue to Review <ChevronRight className="w-4 h-4 ml-2" /></Button>}
                    {step === "review" && (
                        <>
                            <Button onClick={handleGenerateReport} disabled={isGenerating} className="bg-slate-900 text-white font-bold shadow-lg">
                                <FileOutput className="w-4 h-4 mr-2" /> Generate Report
                            </Button>
                            <Button onClick={handleFinalize} className="bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg">
                                <CheckCircle className="w-4 h-4 mr-2" /> Finalize Rating
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-12">
                <div className="lg:col-span-3">
                    <Card className="border-2 shadow-sm">
                        <CardHeader className="bg-slate-50 border-b pb-4">
                            <CardTitle className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Session Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="space-y-4 pb-6 border-b border-dashed">
                                <p className="text-[10px] font-black uppercase text-primary tracking-widest">COUNTRY</p>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Name</label>
                                    <p className="font-black text-slate-900">{country?.name}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Region</label>
                                    <p className="font-black text-slate-900">{country?.region}</p>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Analytical Model</label>
                                <p className="font-black text-slate-900">{selectedModel?.name}</p>
                            </div>
                            <div className="space-y-1 pt-4 border-t">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Rating Scale</label>
                                <p className="font-black text-slate-900">{selectedScale?.name}</p>
                            </div>
                            <div className="space-y-1 pt-4 border-t">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Analytical Year</label>
                                <p className="font-black text-slate-900">{executionYear}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => router.push(`/rate/${id}/init`)} className="w-full text-xs font-bold mt-4 border border-dashed text-primary hover:bg-primary/5">
                                <Settings2 className="w-3 h-3 mr-2" /> Change Config
                            </Button>
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
                                    <Button size="sm" variant="outline" onClick={handleAutoFetch} disabled={isGenerating} className="border-2 font-bold h-10 px-6 hover:bg-slate-50 transition-colors">
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

                                        const val = liveDerivedMetrics[p.id] ?? 0;

                                        return (
                                            <div key={p.id} className="p-8 bg-white rounded-2xl border-2 border-slate-100 shadow-sm flex flex-col justify-between transition-all hover:border-primary/30 hover:shadow-md group">
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-start">
                                                        <p className="text-lg font-black text-slate-900 group-hover:text-primary transition-colors">{p.name}</p>
                                                        <Settings2 className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" />
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-4xl font-black text-primary leading-none tracking-tighter">
                                                            {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

                    {step === "review" && calculation && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <Card className="border-2 overflow-hidden">
                                <CardHeader className="bg-slate-900 text-white py-12 px-12 border-b-8 border-slate-800">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                                        <div className="space-y-2">
                                            <Badge variant="outline" className="text-primary-foreground border-white/20 font-black tracking-widest text-[10px] uppercase px-4 py-1">Analytical Finalization</Badge>
                                            <CardTitle className="text-5xl font-black tracking-tighter mt-4">Executive Summary</CardTitle>
                                            <p className="text-slate-400 font-medium text-lg">Professional credit designation for {country?.name} ({executionYear}).</p>
                                        </div>
                                        <div className="flex gap-8">
                                            <div className="text-right">
                                                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Final Score</p>
                                                <p className="text-4xl font-black tracking-tighter">{calculation.finalScore.toFixed(1)}%</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Implied Rating</p>
                                                <p className="text-5xl font-black tracking-tighter text-primary-foreground">{calculation.initialRating}</p>
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="p-12 space-y-8">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Analytical Rationale</h3>
                                            <div className="h-1 bg-slate-100 flex-1 rounded-full" />
                                            {isGeneratingRationale && (
                                                <div className="flex items-center gap-2 text-primary font-bold animate-pulse">
                                                    <Sparkles className="w-4 h-4 animate-spin-slow" />
                                                    <span className="text-xs uppercase tracking-widest">AI Generating Narrative...</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="relative group">
                                            <Textarea 
                                                className="min-h-[400px] text-lg font-medium leading-relaxed p-8 border-2 border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all bg-slate-50/50"
                                                placeholder="Analytical justification for the credit rating..."
                                                value={rationale}
                                                onChange={(e) => setRationale(e.target.value)}
                                            />
                                            {isGeneratingRationale && (
                                                <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center rounded-lg z-10">
                                                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
                                            <Card className="bg-slate-50 border-none shadow-none">
                                                <CardContent className="p-6">
                                                    <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4">Key Credit Strengths</h4>
                                                    <ul className="space-y-2">
                                                        {Object.entries(calculation.transformedScores || {})
                                                            .filter(([_, score]: any) => score >= 4)
                                                            .slice(0, 3)
                                                            .map(([pid, _]) => (
                                                                <li key={pid} className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                                                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                                                    {parameters.find(p => p.id === pid)?.name || pid}
                                                                </li>
                                                            ))}
                                                    </ul>
                                                </CardContent>
                                            </Card>
                                            <Card className="bg-slate-50 border-none shadow-none">
                                                <CardContent className="p-6">
                                                    <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4">Risk Constraints</h4>
                                                    <ul className="space-y-2">
                                                        {Object.entries(calculation.transformedScores || {})
                                                            .filter(([_, score]: any) => score <= 2)
                                                            .slice(0, 3)
                                                            .map(([pid, _]) => (
                                                                <li key={pid} className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                                                    <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                                                    {parameters.find(p => p.id === pid)?.name || pid}
                                                                </li>
                                                            ))}
                                                    </ul>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
