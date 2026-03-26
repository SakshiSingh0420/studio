
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { getCountries, getModels, getScales, Country, getActiveModels } from "@/lib/store"
import { RatingModel, RatingScale } from "@/lib/rating-engine"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Globe, ShieldCheck, ArrowRight, Settings2 } from "lucide-react"

export default function RatingInitiationPage() {
    const { id } = useParams()
    const router = useRouter()
    
    const [country, setCountry] = useState<Country | null>(null)
    const [models, setModels] = useState<RatingModel[]>([])
    const [scales, setScales] = useState<RatingScale[]>([])
    
    const [selectedModelId, setSelectedModelId] = useState<string>("")
    const [selectedScaleId, setSelectedScaleId] = useState<string>("")
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            try {
                const [countriesData, activeModels, scalesData] = await Promise.all([
                    getCountries(),
                    getActiveModels(),
                    getScales()
                ])
                
                const found = countriesData.find(c => c.id === id)
                if (found) setCountry(found)
                
                setModels(activeModels)
                setScales(scalesData)
                
                if (activeModels.length > 0) setSelectedModelId(activeModels[0].id)
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
        router.push(`/rate/${id}?model=${selectedModelId}&scale=${selectedScaleId}`)
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
                                <p className="text-xs font-bold text-muted-foreground uppercase">Market Class</p>
                                <p className="font-bold text-slate-700">{country?.incomeGroup}</p>
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
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-900 uppercase">Analytical Model</label>
                            <Select onValueChange={setSelectedModelId} value={selectedModelId}>
                                <SelectTrigger className="font-medium h-12"><SelectValue placeholder="Select an active model" /></SelectTrigger>
                                <SelectContent>
                                    {models.length > 0 ? (
                                      models.map(m => <SelectItem key={m.id} value={m.id}>{m.name} (v{m.version})</SelectItem>)
                                    ) : (
                                      <div className="p-2 text-xs text-muted-foreground">No active models found. Please activate a model in settings.</div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-900 uppercase">Rating Scale</label>
                            <Select onValueChange={setSelectedScaleId} value={selectedScaleId}>
                                <SelectTrigger className="font-medium h-12"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {scales.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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
