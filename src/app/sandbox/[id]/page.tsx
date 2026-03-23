
"use client"

import { useState, useEffect, use } from "react"
import { useParams, useRouter } from "next/navigation"
import { getCountries, getFactSheet, getModels, getScales, getParameters } from "@/lib/store"
import { RatingModel, RatingScale, Parameter, runDynamicRating } from "@/lib/rating-engine"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Zap, Play, RotateCcw, TrendingUp, TrendingDown, Info } from "lucide-react"

export default function SandboxPage() {
  const { id } = useParams()
  const [country, setCountry] = useState<any>(null)
  const [baseValues, setBaseValues] = useState<Record<string, number>>({})
  const [stressValues, setStressValues] = useState<Record<string, number>>({})
  const [models, setModels] = useState<RatingModel[]>([])
  const [scales, setScales] = useState<RatingScale[]>([])
  const [params, setParams] = useState<Parameter[]>([])
  const [selectedModel, setSelectedModel] = useState<RatingModel | null>(null)
  const [selectedScale, setSelectedScale] = useState<RatingScale | null>(null)
  const [baseResult, setBaseResult] = useState<any>(null)
  const [stressResult, setStressResult] = useState<any>(null)
  const { toast } = useToast()

  useEffect(() => {
    async function init() {
      const countries = await getCountries()
      const c = countries.find(x => x.id === id)
      if (c) {
        setCountry(c)
        const sheet = await getFactSheet(c.id)
        if (sheet) {
          setBaseValues(sheet)
          setStressValues(sheet)
        }
      }
      setModels(await getModels())
      setScales(await getScales())
      setParams(await getParameters())
    }
    init()
  }, [id])

  const runSimulation = () => {
    if (!selectedModel || !selectedScale) return
    const base = runDynamicRating(baseValues, selectedModel, selectedScale, params)
    const stress = runDynamicRating(stressValues, selectedModel, selectedScale, params)
    setBaseResult(base)
    setStressResult(stress)
    toast({ title: "Simulation Complete", description: "Base and Stress scenarios calculated." })
  }

  const resetStress = () => {
    setStressValues(baseValues)
    setStressResult(null)
  }

  if (!country) return <div>Loading Sandbox...</div>

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Analytical Sandbox: {country.name}</h1>
          <p className="text-muted-foreground mt-1 text-lg">Conduct sensitivity analysis and stress testing simulations.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={resetStress}><RotateCcw className="w-4 h-4 mr-2" /> Reset Stress</Button>
            <Button onClick={runSimulation} className="bg-primary"><Play className="w-4 h-4 mr-2" /> Execute Simulation</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-sm uppercase text-muted-foreground">Framework Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold">Select Model</label>
              <Select onValueChange={v => setSelectedModel(models.find(m => m.id === v)!)}>
                <SelectTrigger><SelectValue placeholder="Model" /></SelectTrigger>
                <SelectContent>{models.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold">Select Scale</label>
              <Select onValueChange={v => setSelectedScale(scales.find(s => s.id === v)!)}>
                <SelectTrigger><SelectValue placeholder="Scale" /></SelectTrigger>
                <SelectContent>{scales.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 grid gap-6 md:grid-cols-2">
            <Card className={baseResult ? 'border-primary shadow-lg' : ''}>
                <CardHeader className="bg-muted/30">
                    <CardTitle className="text-lg">Base Case</CardTitle>
                    {baseResult && <div className="mt-2 text-3xl font-extrabold text-primary">{baseResult.initialRating} <span className="text-sm font-normal text-muted-foreground">({baseResult.finalScore.toFixed(1)}%)</span></div>}
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    {Object.keys(selectedModel?.weights || {}).map(pid => {
                        const p = params.find(p => p.id === pid)
                        return (
                            <div key={pid} className="flex justify-between items-center">
                                <span className="text-sm font-medium">{p?.name}</span>
                                <span className="font-mono text-sm">{baseValues[pid] || 0}</span>
                            </div>
                        )
                    })}
                </CardContent>
            </Card>

            <Card className={stressResult ? (stressResult.finalScore < baseResult.finalScore ? 'border-red-400 shadow-lg' : 'border-green-400 shadow-lg') : ''}>
                <CardHeader className="bg-muted/30">
                    <CardTitle className="text-lg">Stress / Simulation Case</CardTitle>
                    {stressResult && (
                        <div className="mt-2 flex items-center gap-4">
                            <div className="text-3xl font-extrabold text-foreground">{stressResult.initialRating}</div>
                            <div className="flex items-center gap-1 text-sm font-bold">
                                {stressResult.finalScore < baseResult.finalScore ? <TrendingDown className="text-red-500 w-4 h-4" /> : <TrendingUp className="text-green-500 w-4 h-4" />}
                                <span className={stressResult.finalScore < baseResult.finalScore ? 'text-red-500' : 'text-green-500'}>
                                    {(stressResult.finalScore - baseResult.finalScore).toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    {Object.keys(selectedModel?.weights || {}).map(pid => {
                        const p = params.find(p => p.id === pid)
                        return (
                            <div key={pid} className="flex justify-between items-center gap-4">
                                <span className="text-sm font-medium flex-1">{p?.name}</span>
                                <Input 
                                    type="number" 
                                    className="w-24 h-8 text-right" 
                                    value={stressValues[pid] || 0} 
                                    onChange={e => setStressValues({...stressValues, [pid]: Number(e.target.value)})}
                                />
                            </div>
                        )
                    })}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  )
}
