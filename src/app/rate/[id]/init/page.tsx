
"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { getCountries, Country, getActiveModels, getScales } from "@/lib/store"
import { RatingModel, RatingScale } from "@/lib/rating-engine"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Loader2, Globe, ShieldCheck, ArrowRight, Settings2, Star, Info, Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const DEMO_COUNTRIES: Partial<Country>[] = [
  { id: 'demo-in', name: "India", region: "Asia", incomeGroup: "Emerging", currency: "INR", gdpSnapshot: 3400, year: 2025 },
  { id: 'demo-us', name: "United States", region: "North America", incomeGroup: "Advanced", currency: "USD", gdpSnapshot: 26000, year: 2026 },
  { id: 'demo-cn', name: "China", region: "Asia", incomeGroup: "Emerging", currency: "CNY", gdpSnapshot: 18000, year: 2026 },
  { id: 'demo-de', name: "Germany", region: "Europe", incomeGroup: "Advanced", currency: "EUR", gdpSnapshot: 4500, year: 2026 },
  { id: 'demo-br', name: "Brazil", region: "South America", incomeGroup: "Emerging", currency: "BRL", gdpSnapshot: 2100, year: 2026 },
  { id: 'demo-za', name: "South Africa", region: "Africa", incomeGroup: "Emerging", currency: "ZAR", gdpSnapshot: 400, year: 2026 },
];

export default function RatingInitiationPage() {
    const params = useParams()
    const router = useRouter()
    
    // Robust ID extraction
    const rawId = params?.id
    const id = useMemo(() => {
        if (!rawId) return null;
        return Array.isArray(rawId) ? rawId[0] : rawId;
    }, [rawId]);

    const [country, setCountry] = useState<Country | null>(null)
    const [models, setModels] = useState<RatingModel[]>([])
    const [scales, setScales] = useState<RatingScale[]>([])
    
    const [selectedModelId, setSelectedModelId] = useState<string>("")
    const [selectedScaleId, setSelectedScaleId] = useState<string>("")
    const [targetYear, setTargetYear] = useState<number>(2025)
    const [loading, setLoading] = useState(true)

    const getModelApplicability = (model: RatingModel) => {
        if (!country) return { score: 0, label: "Not Recommended", variant: "destructive" as const };
        
        let score = 0;
        const modelName = model.name.toLowerCase();
        const incomeGroup = country.incomeGroup;

        // Matching logic based on Market Classification / Income Group
        // Priority 1: Direct name matching for common templates
        if (incomeGroup === "Emerging" && modelName.includes("emerging")) {
            score = 100;
        } else if (incomeGroup === "Advanced" && (modelName.includes("advanced") || modelName.includes("developed"))) {
            score = 100;
        } else if (incomeGroup === "Frontier" && modelName.includes("frontier")) {
            score = 100;
        }

        // Priority 2: Explicit metadata matching in model applicability object
        if (score === 0 && model.applicability?.incomeGroup?.includes(incomeGroup)) {
            score = 80;
        }

        if (score >= 90) return { score, label: "Highly Recommended", variant: "default" as const };
        if (score >= 70) return { score, label: "Recommended", variant: "secondary" as const };
        return { score, label: "Alternative Framework", variant: "outline" as const };
    };

    const sortedModels = useMemo(() => {
        return [...models].sort((a, b) => {
            const scoreA = getModelApplicability(a).score;
            const scoreB = getModelApplicability(b).score;
            return scoreB - scoreA;
        });
    }, [models, country]);

    useEffect(() => {
        async function load() {
            if (!id) return;
            console.log("Initializing Rating for ID:", id);
            
            try {
                const [dbCountries, activeModels, scalesData] = await Promise.all([
                    getCountries(),
                    getActiveModels(),
                    getScales()
                ])
                
                // Merge demo countries with DB results to ensure 'demo-us' etc. are found
                const allCountries = [
                    ...dbCountries,
                    ...DEMO_COUNTRIES.filter(d => !dbCountries.some(c => c.name.toLowerCase() === d.name?.toLowerCase()))
                ] as Country[];

                const found = allCountries.find(c => String(c.id) === String(id));
                
                if (found) {
                    console.log("Country Found:", found.name);
                    setCountry(found)
                    setTargetYear(found.year || found.dataYear || 2025)
                } else {
                    console.warn("Country NOT Found for ID:", id);
                }
                
                setModels(activeModels)
                setScales(scalesData)
                
                const defaultModel = activeModels.find(m => m.isDefault);
                if (defaultModel) {
                  setSelectedModelId(defaultModel.id);
                }

                if (scalesData.length > 0) setSelectedScaleId(scalesData[0].id)
            } catch (error) {
                console.error("Initialization Error:", error)
            } finally {
                setLoading(false) 
            }
        }
        load()
    }, [id])

    const handleInitialize = () => {
        if (!selectedModelId || !selectedScaleId || !id) return
        router.push(`/rate/${id}?model=${selectedModelId}&scale=${selectedScaleId}&year=${targetYear}`)
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
        <div className="max-w-4xl mx-auto py-12 space-y-8">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary rounded-2xl text-white shadow-xl shadow-primary/20">
                    <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-slate-900">Rating Initiation</h1>
                    <p className="text-muted-foreground font-medium text-lg">Configure the analytical framework for this session.</p>
                </div>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
                <Card className="border-2 shadow-sm">
                    <CardHeader className="bg-slate-50 border-b">
                        <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            <Globe className="w-4 h-4" /> Sovereign Context
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-muted-foreground uppercase">Country</p>
                            <p className="text-2xl font-black text-slate-900">{country?.name}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-muted-foreground uppercase">Region</p>
                                <p className="font-bold text-slate-700">{country?.region}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-muted-foreground uppercase">Market Classification</p>
                                <Badge variant="outline" className="font-bold border-primary/30 text-primary">
                                    {country?.incomeGroup}
                                </Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-2 shadow-sm border-primary/20">
                    <CardHeader className="bg-primary/5 border-b border-primary/10">
                        <CardTitle className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                            <Settings2 className="w-4 h-4" /> Framework Selection
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-900 uppercase flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> Target Year
                                </label>
                                <Input 
                                    type="number" 
                                    value={targetYear} 
                                    onChange={e => setTargetYear(Number(e.target.value))} 
                                    className="font-bold"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-900 uppercase">Rating Scale</label>
                                <Select onValueChange={setSelectedScaleId} value={selectedScaleId}>
                                    <SelectTrigger className="font-medium h-10"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {scales.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-900 uppercase">Analytical Model suitability</label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-[200px] text-[10px] p-2">
                                            Models are ranked by analytical fit to the country's market classification.
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <Select onValueChange={setSelectedModelId} value={selectedModelId}>
                                <SelectTrigger className="font-medium h-12">
                                    <SelectValue placeholder="Select an active model" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sortedModels.length > 0 ? (
                                      sortedModels.map(m => {
                                        const app = getModelApplicability(m);
                                        return (
                                          <SelectItem key={m.id} value={m.id}>
                                            <div className="flex flex-col gap-0.5 py-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold">{m.name} (v{m.version})</span>
                                                    {m.isDefault && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={app.variant} className="text-[9px] h-4 font-black uppercase px-1.5 py-0 leading-none">
                                                        {app.label}
                                                    </Badge>
                                                </div>
                                            </div>
                                          </SelectItem>
                                        );
                                      })
                                    ) : (
                                      <div className="p-2 text-xs text-muted-foreground">No active models found.</div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-end pt-8">
                <Button size="lg" onClick={handleInitialize} disabled={!selectedModelId} className="bg-primary font-bold h-14 px-10 rounded-2xl shadow-xl shadow-primary/20 hover:shadow-2xl hover:translate-y-[-2px] transition-all">
                    Initialize Rating Execution <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
            </div>
        </div>
    )
}
