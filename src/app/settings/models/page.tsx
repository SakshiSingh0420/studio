
"use client"

import { useState, useEffect, useMemo } from "react"
import { getModels, saveModel, getParameters, deleteModel, setActiveModel, setDefaultModel } from "@/lib/store"
import { RatingModel, Parameter, ModelTransformation } from "@/lib/rating-engine"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/accordion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Plus, Save, Layers, Settings2, AlertCircle, CheckCircle2, 
  Search, Filter, Zap, ChevronRight, Info, Trash2, 
  Sparkles, BrainCircuit, Lock, Copy, History, Check, Star,
  Percent, Ruler
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"

const CATEGORIES = ["Economic", "Fiscal", "External", "Monetary", "Institutional", "ESG"] as const;

const PROFESSIONAL_THRESHOLDS: Record<string, ModelTransformation> = {
  "gdp": { thresholds: [500000000000, 1000000000000, 2000000000000, 5000000000000], inverse: false },
  "gdp_growth": { thresholds: [2, 4, 6, 8], inverse: false },
  "inflation": { thresholds: [2, 4, 6, 10], inverse: true },
  "inflation_volatility": { thresholds: [1, 2, 4, 6], inverse: true },
  "debt_to_gdp": { thresholds: [40, 60, 80, 100], inverse: true },
  "fiscal_balance": { thresholds: [-6, -4, -2, 0], inverse: false },
  "government_revenue": { thresholds: [10, 15, 20, 25], inverse: false },
  "interest_payments": { thresholds: [10, 20, 30, 40], inverse: true },
  "fx_reserves": { thresholds: [50000000000, 150000000000, 300000000000, 600000000000], inverse: false },
  "imports": { thresholds: [100000000000, 300000000000, 600000000000, 1000000000000], inverse: true },
  "exports": { thresholds: [100000000000, 300000000000, 600000000000, 1000000000000], inverse: false },
  "reserve_cover": { thresholds: [0.5, 1, 2, 3], inverse: false },
  "exchange_rate_volatility": { thresholds: [2, 5, 10, 15], inverse: true },
  "governance_score": { thresholds: [0.2, 0.4, 0.6, 0.8], inverse: false },
  "political_stability": { thresholds: [0.2, 0.4, 0.6, 0.8], inverse: false },
  "social_risk": { thresholds: [0.2, 0.4, 0.6, 0.8], inverse: true },
  "climate_risk": { thresholds: [0.2, 0.4, 0.6, 0.8], inverse: true }
};

const TEMPLATES: Record<string, Partial<RatingModel>> = {
  "Advanced Economy": { weights: {}, version: 1, name: "Standard Advanced Model", status: 'draft', isActive: false, isDefault: false },
  "Emerging Market": { weights: {}, version: 1, name: "Emerging Market Framework", status: 'draft', isActive: false, isDefault: false },
  "Frontier Market": { weights: {}, version: 1, name: "Frontier Risk Model", status: 'draft', isActive: false, isDefault: false }
};

export default function ModelBuilderPage() {
  const [models, setModels] = useState<RatingModel[]>([])
  const [params, setParams] = useState<Parameter[]>([])
  const [selectedModel, setSelectedModel] = useState<Partial<RatingModel> | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()

  const load = async () => {
    setModels(await getModels())
    setParams(await getParameters())
  }
  useEffect(() => { load() }, [])

  const isPublished = selectedModel?.status === 'published';

  const totalWeight = useMemo(() => {
    if (!selectedModel?.weights) return 0;
    return Object.values(selectedModel.weights).reduce((a, b) => a + (b || 0), 0);
  }, [selectedModel?.weights]);

  const categoryWeights = useMemo(() => {
    const weights: Record<string, number> = {};
    CATEGORIES.forEach(cat => {
      let catTotal = 0;
      params.filter(p => p.category === cat).forEach(p => {
        catTotal += (selectedModel?.weights?.[p.id] || 0);
      });
      weights[cat] = catTotal;
    });
    return weights;
  }, [selectedModel?.weights, params]);

  const handleSave = async (status: 'draft' | 'published' = 'draft') => {
    if (!selectedModel?.name) return
    if (totalWeight !== 100) {
      toast({ 
        title: "Validation Failed", 
        description: `Total weight must be exactly 100%. Current: ${totalWeight}%`, 
        variant: "destructive" 
      });
      return;
    }

    try {
        const dataToSave = { 
          ...selectedModel, 
          status,
          version: selectedModel.version ?? 1,
          isActive: selectedModel.isActive ?? false,
          isDefault: selectedModel.isDefault ?? false
        };
        const savedId = await saveModel(dataToSave);
        setSelectedModel(prev => prev ? { ...prev, id: savedId, status } : null);
        await load();
        toast({ title: status === 'published' ? "Framework Published & Locked" : "Draft Saved" });
    } catch (error) {
        toast({ title: "Save Failed", variant: "destructive" });
    }
  }

  const handleClone = async () => {
    if (!selectedModel) return;
    const clonedModel = {
      ...selectedModel,
      id: undefined,
      name: `${selectedModel.name} (Copy)`,
      version: 1,
      status: 'draft',
      isActive: false,
      isDefault: false,
      parentModelId: undefined
    };
    setSelectedModel(clonedModel as any);
    toast({ title: "Model Cloned", description: "You are now editing a new draft." });
  }

  const handleNewVersion = async () => {
    if (!selectedModel) return;
    const nextVersion = {
      ...selectedModel,
      id: undefined,
      version: (selectedModel.version ?? 1) + 1,
      status: 'draft',
      isActive: false,
      isDefault: false,
      parentModelId: selectedModel.id
    };
    setSelectedModel(nextVersion as any);
    toast({ title: "New Version Created", description: "Old version remains locked. This version is a draft." });
  }

  const handleActivate = async (checked: boolean) => {
    if (!selectedModel?.id || !selectedModel.name) return;
    if (selectedModel.status !== 'published') {
      toast({ title: "Publication Required", description: "Only published models can be activated.", variant: "destructive" });
      return;
    }
    await setActiveModel(selectedModel.id, selectedModel.name);
    await load();
    setSelectedModel(prev => prev ? { ...prev, isActive: checked } : null);
    toast({ title: checked ? "Model Activated" : "Model Deactivated" });
  }

  const handleSetDefault = async (checked: boolean) => {
    if (!selectedModel?.id) return;
    if (selectedModel.status !== 'published') {
      toast({ title: "Publication Required", description: "Only published models can be marked as default.", variant: "destructive" });
      return;
    }
    if (!checked) {
      toast({ title: "Constraint", description: "One model must always be default. Select another model to unset this one.", variant: "destructive" });
      return;
    }
    await setDefaultModel(selectedModel.id);
    await load();
    setSelectedModel(prev => prev ? { ...prev, isDefault: true } : null);
    toast({ title: "Default Framework Updated" });
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteModel(id);
      if (selectedModel?.id === id) setSelectedModel(null);
      await load();
      toast({ title: "Model deleted successfully" });
    } catch (error) {
      toast({ title: "Failed to delete model", variant: "destructive" });
    }
  }

  const toggleParam = (pid: string) => {
    if (!selectedModel || isPublished) return
    const weights = { ...(selectedModel.weights || {}) }
    const trans = { ...(selectedModel.transformations || {}) }
    if (weights[pid] !== undefined) {
      delete weights[pid]
      delete trans[pid]
    } else {
      weights[pid] = 0
      const param = params.find(p => p.id === pid);
      const slug = (param?.slug || "").toLowerCase();
      const defaultTrans = PROFESSIONAL_THRESHOLDS[slug] || { thresholds: [20, 40, 60, 80], inverse: false };
      trans[pid] = { ...defaultTrans };
    }
    setSelectedModel({ ...selectedModel, weights, transformations: trans })
  }

  const handleWeightChange = (pid: string, val: number) => {
    if (!selectedModel || isPublished) return;
    setSelectedModel({
      ...selectedModel,
      weights: { ...selectedModel.weights, [pid]: val }
    });
  }

  const applyTemplate = (name: string) => {
      const template = TEMPLATES[name];
      if (template) {
          setSelectedModel({ ...selectedModel, ...template, id: selectedModel?.id });
          toast({ title: `Applied ${name} Template` });
      }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Model Builder</h1>
          <p className="text-muted-foreground mt-1 text-lg">Configure weighted analytical frameworks and scoring transformations.</p>
        </div>
        <div className="flex gap-2">
            {!isPublished && (
              <Select onValueChange={applyTemplate}>
                  <SelectTrigger className="w-[180px] bg-muted/50">
                      <Zap className="w-4 h-4 mr-2 text-yellow-500" />
                      <SelectValue placeholder="Load Template" />
                  </SelectTrigger>
                  <SelectContent>
                      {Object.keys(TEMPLATES).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
              </Select>
            )}
            <Button onClick={() => setSelectedModel({ name: "New Model", version: 1, weights: {}, transformations: {}, status: 'draft', isActive: false, isDefault: false })}>
                <Plus className="w-4 h-4 mr-2" /> New Framework
            </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-1 space-y-4">
          <Card className="bg-muted/10 border-none shadow-none">
            <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Framework Library</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {models.sort((a,b) => b.version - a.version).map(m => (
                    <div 
                        key={m.id} 
                        className={cn(
                            "group cursor-pointer p-3 rounded-lg border bg-card transition-all hover:border-primary relative",
                            selectedModel?.id === m.id && "border-primary ring-1 ring-primary shadow-sm"
                        )} 
                        onClick={() => setSelectedModel(m)}
                    >
                        <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-sm truncate">{m.name}</p>
                                  {m.isDefault && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-[9px] h-4 font-mono">v{m.version}</Badge>
                                  <Badge variant={m.status === 'published' ? 'default' : 'secondary'} className="text-[9px] h-4">
                                    {m.status}
                                  </Badge>
                                  {m.isActive && <Badge className="text-[9px] h-4 bg-green-500 hover:bg-green-600">Active</Badge>}
                                </div>
                            </div>
                            <Layers className={cn("w-4 h-4 opacity-20 group-hover:opacity-100", selectedModel?.id === m.id && "text-primary opacity-100")} />
                        </div>
                    </div>
                ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {selectedModel ? (
            <Card className="border-2 relative overflow-hidden">
              <CardHeader className="border-b bg-card sticky top-0 z-20 shadow-sm">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl">Analytical Architecture</CardTitle>
                      {isPublished && <Lock className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <CardDescription>
                      {isPublished 
                        ? "This version is locked. Create a new version to make changes." 
                        : "Assign pillar weights and define transformation thresholds."}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full border-2 font-bold transition-all whitespace-nowrap text-sm",
                        totalWeight === 100 ? "bg-green-50 border-green-500 text-green-700" : "bg-red-50 border-red-500 text-red-700"
                    )}>
                        {totalWeight === 100 ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {totalWeight}%
                    </div>
                    
                    {isPublished ? (
                      <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex items-center gap-4 border-l pl-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Active</span>
                            <Switch checked={selectedModel.isActive} onCheckedChange={handleActivate} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Default</span>
                            <Switch checked={selectedModel.isDefault} onCheckedChange={handleSetDefault} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={handleNewVersion}><History className="w-3.5 h-3.5 mr-2" /> New Version</Button>
                          <Button variant="outline" size="sm" onClick={handleClone}><Copy className="w-3.5 h-3.5 mr-2" /> Clone</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => handleSave('draft')}><Save className="w-4 h-4 mr-2" /> Save Draft</Button>
                        <Button onClick={() => handleSave('published')} className="bg-primary"><Check className="w-4 h-4 mr-2" /> Publish Version</Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Framework Name</label>
                      <Input value={selectedModel.name} disabled={isPublished} onChange={e => setSelectedModel({...selectedModel, name: e.target.value})} className="font-bold" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Version</label>
                      <Input value={selectedModel.version} disabled className="font-mono bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Status</label>
                      <Badge className="h-10 w-full justify-center text-sm font-bold uppercase" variant={isPublished ? 'default' : 'secondary'}>
                        {selectedModel.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 space-y-4">
                    <h3 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
                      <BrainCircuit className="w-4 h-4" /> Model Definition Guidelines
                    </h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Percent className="w-3 h-3 text-primary" /> Analytical Weights
                        </p>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          Weights are specified in percentage (%). The sum of all active parameter weights must equal exactly 100% to ensure quantitative accuracy.
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Ruler className="w-3 h-3 text-primary" /> Scoring Thresholds
                        </p>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          Thresholds define the transition points for scoring. T2-T5 represent the boundaries for converting raw metrics into analytical 1-5 scores.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Accordion type="multiple" defaultValue={["Economic"]} className="space-y-4">
                    {CATEGORIES.map(cat => {
                        const catParams = params.filter(p => p.category === cat);
                        const weight = categoryWeights[cat];
                        return (
                            <AccordionItem key={cat} value={cat} className="border rounded-lg overflow-hidden bg-card">
                                <AccordionTrigger className="px-4 py-4 hover:no-underline">
                                    <div className="flex items-center justify-between w-full pr-4">
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className="font-mono">{catParams.length}</Badge>
                                            <span className="font-bold text-lg">{cat}</span>
                                        </div>
                                        <div className="font-bold text-primary">{weight}% Aggregate Weight</div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-0 border-t">
                                    <div className="divide-y">
                                        {catParams.map(p => {
                                            const isActive = selectedModel.weights?.[p.id] !== undefined;
                                            return (
                                                <div key={p.id} className={cn("p-4 transition-colors", isActive ? "bg-primary/5" : "hover:bg-muted/10")}>
                                                    <div className="flex items-center gap-4">
                                                        <Checkbox checked={isActive} disabled={isPublished} onCheckedChange={() => toggleParam(p.id)} />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-sm">{p.name}</span>
                                                                <Badge variant="outline" className="text-[9px] h-4">{p.type}</Badge>
                                                            </div>
                                                        </div>
                                                        {isActive && (
                                                            <div className="flex items-center gap-2">
                                                                <div className="text-right flex flex-col items-end">
                                                                    <span className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1">Impact Weight</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <Input 
                                                                            type="number" 
                                                                            disabled={isPublished}
                                                                            className="w-20 h-9 font-bold text-right" 
                                                                            value={selectedModel.weights?.[p.id]} 
                                                                            onChange={e => handleWeightChange(p.id, Number(e.target.value))} 
                                                                        />
                                                                        <span className="text-xs font-bold opacity-40">%</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    {isActive && (
                                                        <div className="mt-4 pl-8 pt-4 border-t border-primary/10 space-y-3">
                                                            <div className="flex items-center gap-2">
                                                                <Ruler className="w-3 h-3 text-primary" />
                                                                <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider">Analytical Scoring Thresholds (Benchmarks)</span>
                                                            </div>
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                                {selectedModel.transformations?.[p.id]?.thresholds.map((t, i) => (
                                                                    <div key={i} className="space-y-1">
                                                                        <label className="text-[9px] text-muted-foreground uppercase font-black">Score Tier {i+2}</label>
                                                                        <Input 
                                                                            type="number" 
                                                                            disabled={isPublished}
                                                                            className="h-8 text-xs font-mono" 
                                                                            value={t} 
                                                                            onChange={e => {
                                                                                const newT = [...selectedModel.transformations![p.id].thresholds]
                                                                                newT[i] = Number(e.target.value)
                                                                                setSelectedModel({
                                                                                    ...selectedModel,
                                                                                    transformations: {
                                                                                        ...selectedModel.transformations,
                                                                                        [p.id]: { ...selectedModel.transformations![p.id], thresholds: newT as any }
                                                                                    }
                                                                                })
                                                                            }}
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )
                    })}
                  </Accordion>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="h-[600px] flex flex-col items-center justify-center border-2 border-dashed rounded-xl bg-muted/20">
              <Settings2 className="w-12 h-12 text-primary opacity-20 mb-4" />
              <p className="text-muted-foreground font-semibold">Select or create an analytical framework.</p>
              <Button variant="outline" className="mt-6" onClick={() => setSelectedModel({ name: "New Model", version: 1, weights: {}, transformations: {}, status: 'draft', isActive: false, isDefault: false })}>
                  <Plus className="w-4 h-4 mr-2" /> Create New Model
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
