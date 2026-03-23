
"use client"

import { useState, useEffect } from "react"
import { getModels, saveModel, getParameters } from "@/lib/store"
import { RatingModel, Parameter } from "@/lib/rating-engine"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Save, Layers, Settings2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function ModelBuilderPage() {
  const [models, setModels] = useState<RatingModel[]>([])
  const [params, setParams] = useState<Parameter[]>([])
  const [selectedModel, setSelectedModel] = useState<Partial<RatingModel> | null>(null)
  const { toast } = useToast()

  const load = async () => {
    setModels(await getModels())
    setParams(await getParameters())
  }
  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!selectedModel?.name) return
    await saveModel(selectedModel as RatingModel)
    setSelectedModel(null)
    load()
    toast({ title: "Model Configuration Saved" })
  }

  const toggleParam = (pid: string) => {
    if (!selectedModel) return
    const weights = { ...(selectedModel.weights || {}) }
    const trans = { ...(selectedModel.transformations || {}) }
    if (weights[pid]) {
      delete weights[pid]
      delete trans[pid]
    } else {
      weights[pid] = 0
      trans[pid] = { thresholds: [20, 40, 60, 80], inverse: false }
    }
    setSelectedModel({ ...selectedModel, weights, transformations: trans })
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Model Builder</h1>
          <p className="text-muted-foreground mt-1">Construct and weight complex analytical frameworks.</p>
        </div>
        <Button onClick={() => setSelectedModel({ name: "New Model", version: "1.0", weights: {}, transformations: {} })}>
          <Plus className="w-4 h-4 mr-2" /> New Model
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-1 space-y-4">
          {models.map(m => (
            <Card key={m.id} className={`cursor-pointer hover:border-primary transition-colors ${selectedModel?.id === m.id ? 'border-primary shadow-md' : ''}`} onClick={() => setSelectedModel(m)}>
              <CardContent className="p-4">
                <p className="font-bold">{m.name}</p>
                <p className="text-xs text-muted-foreground">Version {m.version}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-3">
          {selectedModel ? (
            <Card>
              <CardHeader className="border-b">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Configure Framework</CardTitle>
                    <CardDescription>Select parameters and assign weights.</CardDescription>
                  </div>
                  <Button onClick={handleSave} className="bg-primary"><Save className="w-4 h-4 mr-2" /> Save Framework</Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase">Model Name</label>
                      <Input value={selectedModel.name} onChange={e => setSelectedModel({...selectedModel, name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase">Version</label>
                      <Input value={selectedModel.version} onChange={e => setSelectedModel({...selectedModel, version: e.target.value})} />
                    </div>
                  </div>

                  <Tabs defaultValue="weights">
                    <TabsList>
                      <TabsTrigger value="weights">Parameter Weights</TabsTrigger>
                      <TabsTrigger value="scoring">Scoring Thresholds</TabsTrigger>
                    </TabsList>
                    <TabsContent value="weights" className="pt-4 space-y-4">
                      {params.map(p => (
                        <div key={p.id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/30">
                          <Checkbox checked={!!selectedModel.weights?.[p.id]} onCheckedChange={() => toggleParam(p.id)} />
                          <div className="flex-1">
                            <p className="text-sm font-semibold">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.category}</p>
                          </div>
                          {selectedModel.weights?.[p.id] !== undefined && (
                            <div className="flex items-center gap-2">
                              <Input 
                                type="number" 
                                className="w-20 h-8" 
                                value={selectedModel.weights[p.id]} 
                                onChange={e => setSelectedModel({
                                  ...selectedModel, 
                                  weights: { ...selectedModel.weights, [p.id]: Number(e.target.value) }
                                })} 
                              />
                              <span className="text-xs font-bold">%</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </TabsContent>
                    <TabsContent value="scoring" className="pt-4 space-y-6">
                      {Object.keys(selectedModel.weights || {}).map(pid => {
                        const p = params.find(p => p.id === pid)
                        if (!p) return null
                        return (
                          <div key={pid} className="space-y-3 p-4 border rounded-lg">
                            <div className="flex justify-between items-center">
                              <p className="font-bold text-sm">{p.name}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-xs">Inverse Scoring?</span>
                                <Checkbox 
                                  checked={selectedModel.transformations?.[pid]?.inverse} 
                                  onCheckedChange={v => setSelectedModel({
                                    ...selectedModel,
                                    transformations: {
                                      ...selectedModel.transformations,
                                      [pid]: { ...selectedModel.transformations![pid], inverse: !!v }
                                    }
                                  })}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                              {selectedModel.transformations?.[pid]?.thresholds.map((t, i) => (
                                <div key={i} className="space-y-1">
                                  <label className="text-[10px] text-muted-foreground uppercase">T{i+1} Score</label>
                                  <Input 
                                    type="number" 
                                    className="h-8" 
                                    value={t} 
                                    onChange={e => {
                                      const newT = [...selectedModel.transformations![pid].thresholds]
                                      newT[i] = Number(e.target.value)
                                      setSelectedModel({
                                        ...selectedModel,
                                        transformations: {
                                          ...selectedModel.transformations,
                                          [pid]: { ...selectedModel.transformations![pid], thresholds: newT as any }
                                        }
                                      })
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </TabsContent>
                  </Tabs>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="h-full flex flex-col items-center justify-center border-2 border-dashed rounded-lg py-20 bg-muted/20">
              <Settings2 className="w-12 h-12 text-muted-foreground opacity-30 mb-4" />
              <p className="text-muted-foreground font-medium">Select a model from the list to edit or create a new framework.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
