
"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { getCountries, Country, getActiveModels, getScales } from "@/lib/store"
import { RatingModel, RatingScale } from "@/lib/rating-engine"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Loader2, Globe, ShieldCheck, ArrowRight, Settings2, Star, CheckCircle2, AlertCircle, Info, Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export default function RatingInitiationPage() {
    const { id } = useParams()
    const router = useRouter()
    
    const [country, setCountry] = useState<Country | null>(null)
    const [models, setModels] = useState<RatingModel[]>([])
    const [scales, setScales] = useState<RatingScale[]>([])
    
    const [selectedModelId, setSelectedModelId] = useState<string>("")
    const [selectedScaleId, setSelectedScaleId] = useState<string>("")
    const [targetYear, setTargetYear] = useState<number>(2025)
    const [loading, setLoading] = useState(true)

    const sizeCategory = useMemo(() => {
        if (!country?.gdpSnapshot) return "Small";
        if (country.gdpSnapshot < 500) return "Small";
        if (country.gdpSnapshot <= 2000) return "Medium";
        return "Large";
    }, [country]);

    const getModelApplicability = (model: RatingModel) => {
        if (!country) return { score: 0, label: "Not Recommended", variant: "destructive" as const };
        
        let score = 0;
        const app = model.applicability || {};
        
        if (app.marketType?.includes(country.region)) score += 50;
        if (app.incomeGroup?.includes(country.incomeGroup)) score += 25;
        if (app.sizeCategory?.includes(sizeCategory)) score += 25;

        if (score >= 75) return { score, label: "Highly Applicable", variant: "default" as const };
        if (score >= 50) return { score, label: "Applicable", variant: "secondary" as const };
        return { score, label: "Not Recommended", variant: "outline" as const };
    };

    const sortedModels = useMemo(() => {
        return [...models].sort((a, b) => {
            const scoreA = getModelApplicability(a).score;
            const scoreB = getModelApplicability(b).score;
            return scoreB - scoreA;
        });
    }, [models, country, sizeCategory]);

    useEffect(() => {
        async function load() {
            try {
                const [countriesData, activeModels, scalesData] = await Promise.all([
                    getCountries(),
                    getActiveModels(),
                    getScales()
                ])
                
                const found = countriesData.find(c => c.id === id)
                if (found) {
                    setCountry(found)
                    setTargetYear(found.year || found.dataYear || 2025)
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
        if (!selectedModelId || !selectedScaleId) return
        router.push(`/rate/${id}?model=${selectedModelId}&scale=${selectedScaleId}&year=${targetYear}`)
    }

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>

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
                                <p className="text-xs font-bold text-muted-foreground uppercase">Income Group</p>
                                <p className="font-bold text-slate-700">{country?.incomeGroup}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-muted-foreground uppercase">Size Category</p>
                                <Badge variant="outline" className="font-bold border-primary/30 text-primary">
                                    {sizeCategory} ({country?.gdpSnapshot ? `$${country.gdpSnapshot}B` : 'N/A'})
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
                                <label className="text-xs font-bold text-slate-900 uppercase">Analytical Model</label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-[200px] text-[10px] p-2">
                                            Models are ranked by applicability to the country's economic profile.
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
