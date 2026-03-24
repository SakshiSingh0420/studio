
"use client"

import { useState, useEffect, useMemo } from "react"
import { getModels, saveModel, getParameters, deleteModel } from "@/lib/store"
import { RatingModel, Parameter, ModelTransformation } from "@/lib/rating-engine"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Save, Layers, Settings2, AlertCircle, CheckCircle2, Search, Filter, Zap, ChevronRight, Info, Trash2 } from "lucide-react"
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

const CATEGORIES = ["Economic", "Fiscal", "External", "Monetary", "Institutional", "ESG"] as const;

const TEMPLATES: Record<string, Partial<RatingModel>> = {
  "Advanced Economy": {
    weights: { /* Logic would map IDs here, simplified for demo structure */ },
    version: "1.0",
    name: "Standard Advanced Model"
  },
  "Emerging Market": {
    weights: {},
    version: "1.0",
    name: "Emerging Market Framework"
  },
  "Frontier Market": {
    weights: {},
    version: "1.0",
    name: "Frontier Risk Model"
  }
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

  const handleSave = async () => {
    if (!selectedModel?.name) return
    if (totalWeight !== 100) {
      toast({ 
        title: "Validation Failed", 
        description: `Total weight must be exactly 100%. Current: ${totalWeight}%`, 
        variant: "destructive" 
      });
      return;
    }

    // 1. Backup before save
    const backup = { ...selectedModel };

    // 2. Safe Data Cleaning Function
    const cleanObject = (obj: any): any => {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) {
            return obj.map(item => cleanObject(item));
        }
        const cleaned: any = {};
        Object.keys(obj).forEach(key => {
            const val = obj[key];
            if (val === undefined) return;
            if (val !== null && typeof val === 'object') {
                cleaned[key] = cleanObject(val);
            } else {
                cleaned[key] = val;
            }
        });
        return cleaned;
    };

    try {
        const cleanedData = cleanObject(selectedModel);
        
        // 3. Save operation (returns the ID, ensuring we don't save 'id' inside the doc)
        const savedId = await saveModel(cleanedData);
        
        // 4. Update state with ID if it was a new model, but DO NOT reset form
        if (!selectedModel.id) {
            setSelectedModel(prev => prev ? { ...prev, id: savedId } : null);
        }
        
        await load();
        toast({ title: "Analytical Framework Finalized" });
    } catch (error) {
        console.error("Firestore Save Error:", error);
        // 5. Restore previous state automatically if save fails
        setSelectedModel(backup);
        toast({ 
            title: "Save Failed", 
            description: "Model not saved, your data is safe. Please try again.", 
            variant: "destructive" 
        });
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteModel(id);
      if (selectedModel?.id === id) {
        setSelectedModel(null);
      }
      await load();
      toast({ title: "Model deleted successfully" });
    } catch (error) {
      console.error("Delete Model Error:", error);
      toast({ title: "Failed to delete model", variant: "destructive" });
    }
  }

  const toggleParam = (pid: string) => {
    if (!selectedModel) return
    const weights = { ...(selectedModel.weights || {}) }
    const trans = { ...(selectedModel.transformations || {}) }
    if (weights[pid] !== undefined) {
      delete weights[pid]
      delete trans[pid]
    } else {
      weights[pid] = 0
      trans[pid] = { thresholds: [20, 40, 60, 80], inverse: false }
    }
    setSelectedModel({ ...selectedModel, weights, transformations: trans })
  }

  const handleWeightChange = (pid: string, val: number) => {
    if (!selectedModel) return;
    setSelectedModel({
      ...selectedModel,
      weights: { ...selectedModel.weights, [pid]: val }
    });
  }

  const applyTemplate = (name: string) => {
      const template = TEMPLATES[name];
      if (template) {
          setSelectedModel({
              ...selectedModel,
              ...template,
              id: selectedModel?.id // Preserve ID if editing
          });
          toast({ title: `Applied ${name} Template` });
      }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Model Builder</h1>
          <p className="text-muted-foreground mt-1">Configure weighted analytical frameworks and scoring transformations.</p>
        </div>
        <div className="flex gap-2">
            <Select onValueChange={applyTemplate}>
                <SelectTrigger className="w-[200px] bg-muted/50">
                    <Zap className="w-4 h-4 mr-2 text-yellow-500" />
                    <SelectValue placeholder="Load Template" />
                </SelectTrigger>
                <SelectContent>
                    {Object.keys(TEMPLATES).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
            </Select>
            <Button onClick={() => setSelectedModel({ name: "New Analytical Model", version: "1.0", weights: {}, transformations: {} })}>
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
                {models.map(m => (
                    <div 
                        key={m.id} 
                        className={cn(
                            "group cursor-pointer p-3 rounded-lg border bg-card transition-all hover:border-primary",
                            selectedModel?.id === m.id && "border-primary ring-1 ring-primary shadow-sm"
                        )} 
                        onClick={() => setSelectedModel(m)}
                    >
                        <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate">{m.name}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-mono">v{m.version}</p>
                            </div>
                            <div className="flex items-center gap-1">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Framework?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Are you sure you want to delete "{m.name}"? This action is permanent and cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction 
                                                onClick={() => handleDelete(m.id)}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                                Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                <Layers className={cn("w-4 h-4 opacity-20 group-hover:opacity-100 transition-opacity", selectedModel?.id === m.id && "text-primary opacity-100")} />
                            </div>
                        </div>
                    </div>
                ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {selectedModel ? (
            <Card className="border-2 relative overflow-hidden">
              <CardHeader className="border-b bg-card sticky top-0 z-20 shadow-sm transition-shadow">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">Analytical Architecture</CardTitle>
                    <CardDescription>Assign pillar weights and define transformation thresholds.</CardDescription>
                  </div>
                  <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full border-2 font-bold transition-all whitespace-nowrap text-sm",
                        totalWeight === 100 ? "bg-green-50 border-green-500 text-green-700" : "bg-red-50 border-red-500 text-red-700"
                    )}>
                        {totalWeight === 100 ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        Total Weight: {totalWeight}%
                    </div>
                    <Button onClick={handleSave} className="bg-primary shadow-lg hover:shadow-xl transition-all flex-1 lg:flex-none">
                        <Save className="w-4 h-4 mr-2" /> Save Framework
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Framework Designation</label>
                      <Input value={selectedModel.name} onChange={e => setSelectedModel({...selectedModel, name: e.target.value})} className="font-bold" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Version Control</label>
                      <Input value={selectedModel.version} onChange={e => setSelectedModel({...selectedModel, version: e.target.value})} />
                    </div>
                  </div>

                  <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="Filter parameters within builder..." 
                        className="pl-10"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                  </div>

                  <Accordion type="multiple" defaultValue={["Economic"]} className="space-y-4">
                    {CATEGORIES.map(cat => {
                        const catParams = params.filter(p => p.category === cat && p.name.toLowerCase().includes(searchTerm.toLowerCase()));
                        const weight = categoryWeights[cat];
                        
                        return (
                            <AccordionItem key={cat} value={cat} className="border rounded-lg overflow-hidden bg-card">
                                <AccordionTrigger className="px-4 py-4 hover:bg-muted/30 hover:no-underline">
                                    <div className="flex items-center justify-between w-full pr-4">
                                        <div className="flex items-center gap-3 text-left">
                                            <Badge variant="outline" className="bg-muted text-primary font-mono">{catParams.length}</Badge>
                                            <span className="font-bold text-lg">{cat}</span>
                                        </div>
                                        <div className={cn(
                                            "flex items-center gap-2 px-3 py-1 rounded-md border text-sm font-bold",
                                            weight > 0 ? "border-primary text-primary" : "border-muted text-muted-foreground"
                                        )}>
                                            <Layers className="w-3.5 h-3.5" />
                                            {weight}%
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-0 border-t">
                                    <div className="divide-y">
                                        {catParams.map(p => {
                                            const isActive = selectedModel.weights?.[p.id] !== undefined;
                                            return (
                                                <div key={p.id} className={cn("p-4 transition-colors", isActive ? "bg-primary/5" : "hover:bg-muted/10")}>
                                                    <div className="flex items-center gap-4">
                                                        <Checkbox checked={isActive} onCheckedChange={() => toggleParam(p.id)} />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-bold text-sm truncate">{p.name}</span>
                                                                <Badge variant="outline" className="text-[9px] h-4 border-none bg-muted font-mono">{p.slug}</Badge>
                                                                <Badge variant="outline" className={cn(
                                                                    "text-[9px] h-4",
                                                                    p.type === 'raw' ? "text-blue-600 border-blue-100" : "text-purple-600 border-purple-100"
                                                                )}>{p.type}</Badge>
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground mt-0.5">{p.dataSource}</p>
                                                        </div>
                                                        {isActive && (
                                                            <div className="flex items-center gap-2">
                                                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Weight</label>
                                                                <div className="relative">
                                                                    <Input 
                                                                        type="number" 
                                                                        className="w-20 h-9 font-bold text-right pr-6" 
                                                                        value={selectedModel.weights?.[p.id]} 
                                                                        onChange={e => handleWeightChange(p.id, Number(e.target.value))} 
                                                                    />
                                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold opacity-40">%</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    {isActive && (
                                                        <div className="mt-4 pl-8 pt-4 border-t border-primary/10">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <h4 className="text-[11px] font-bold uppercase text-primary/70 flex items-center gap-1.5">
                                                                    <Settings2 className="w-3 h-3" />
                                                                    Scoring Transformations (1-5 Scale)
                                                                </h4>
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-[10px] font-medium text-muted-foreground">Inverse Logic?</span>
                                                                    <Checkbox 
                                                                        checked={selectedModel.transformations?.[p.id]?.inverse} 
                                                                        onCheckedChange={v => setSelectedModel({
                                                                            ...selectedModel,
                                                                            transformations: {
                                                                                ...selectedModel.transformations,
                                                                                [p.id]: { ...selectedModel.transformations![p.id], inverse: !!v }
                                                                            }
                                                                        })}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                                {selectedModel.transformations?.[p.id]?.thresholds.map((t, i) => (
                                                                    <div key={i} className="space-y-1">
                                                                        <label className="text-[9px] text-muted-foreground uppercase flex justify-between">
                                                                            <span>Score {i+2} Threshold</span>
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger><Info className="w-2.5 h-2.5 opacity-50" /></TooltipTrigger>
                                                                                    <TooltipContent className="text-[10px]">Value required to achieve a score of {i+2}</TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        </label>
                                                                        <Input 
                                                                            type="number" 
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
                                        {catParams.length === 0 && (
                                            <div className="p-8 text-center text-muted-foreground text-xs italic">
                                                No parameters matching "{searchTerm}" in this category.
                                            </div>
                                        )}
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
              <div className="bg-background p-6 rounded-full shadow-sm mb-4">
                  <Settings2 className="w-12 h-12 text-primary opacity-20" />
              </div>
              <p className="text-muted-foreground font-semibold">Select an analytical framework to begin configuration.</p>
              <p className="text-xs text-muted-foreground mt-2">Manage weights, scoring ranges, and market-specific templates.</p>
              <Button variant="outline" className="mt-6" onClick={() => setSelectedModel({ name: "New Analytical Model", version: "1.0", weights: {}, transformations: {} })}>
                  <Plus className="w-4 h-4 mr-2" /> Create New Model
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
