"use client"

import { useState, useEffect } from "react"
import { getParameters, saveParameter, deleteParameter } from "@/lib/store"
import { Parameter } from "@/lib/rating-engine"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Plus, Trash2, Edit2, Info, Code, Layers } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const CATEGORIES = ["Economic", "Fiscal", "External", "Monetary", "Institutional", "ESG"] as const;

export default function ParameterMasterPage() {
  const [params, setParams] = useState<Parameter[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [current, setCurrent] = useState<Partial<Parameter>>({
    name: "",
    slug: "",
    category: "Economic",
    type: "raw",
    dataSource: "Manual",
    frequency: "Annual",
    dependentParameters: []
  })
  const { toast } = useToast()

  const load = async () => setParams(await getParameters())
  useEffect(() => { load() }, [])

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[-\s]+/g, '_')
  }

  const handleNameChange = (name: string) => {
    setCurrent({
      ...current,
      name,
      slug: generateSlug(name)
    })
  }

  const handleSave = async () => {
    if (!current.name || !current.slug) {
        toast({ title: "Validation Error", description: "Name and Slug are required.", variant: "destructive" })
        return
    }
    await saveParameter(current as Parameter)
    setIsAdding(false)
    setCurrent({ 
      name: "", 
      slug: "",
      category: "Economic", 
      type: "raw", 
      dataSource: "Manual", 
      frequency: "Annual",
      dependentParameters: []
    })
    load()
    toast({ title: "Parameter Saved" })
  }

  const handleDelete = async (id: string) => {
    await deleteParameter(id)
    load()
    toast({ title: "Parameter Deleted", variant: "destructive" })
  }

  const toggleDependency = (id: string) => {
    const currentDeps = current.dependentParameters || [];
    if (currentDeps.includes(id)) {
      setCurrent({ ...current, dependentParameters: currentDeps.filter(d => d !== id) });
    } else {
      setCurrent({ ...current, dependentParameters: [...currentDeps, id] });
    }
  }

  const groupedParams = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = params
      .filter(p => p.category === cat)
      .sort((a, b) => a.name.localeCompare(b.name));
    return acc;
  }, {} as Record<string, Parameter[]>);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Parameter Master</h1>
          <p className="text-muted-foreground mt-1 text-lg">Define and categorize analytical factors for rating frameworks.</p>
        </div>
        <Button onClick={() => {
          setCurrent({
            name: "",
            slug: "",
            category: "Economic",
            type: "raw",
            dataSource: "Manual",
            frequency: "Annual",
            dependentParameters: []
          });
          setIsAdding(true);
        }}>
          <Plus className="w-4 h-4 mr-2" /> Define Parameter
        </Button>
      </div>

      <div className="grid gap-6">
        <Accordion type="multiple" defaultValue={["Economic"]} className="w-full space-y-4">
          {CATEGORIES.map((category) => (
            <AccordionItem key={category} value={category} className="border rounded-lg bg-card px-4 shadow-sm">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3">
                  <Layers className="w-5 h-5 text-primary opacity-70" />
                  <span className="text-lg font-semibold">{category}</span>
                  <Badge variant="secondary" className="ml-2">
                    {groupedParams[category].length} Factors
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[30%]">Name & Identifier</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedParams[category].length > 0 ? (
                      groupedParams[category].map(p => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground">{p.name}</span>
                              <span className="text-[10px] font-mono text-primary flex items-center gap-1">
                                <Code className="w-2.5 h-2.5" /> {p.slug}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={p.type === 'derived' ? 'outline' : 'default'} className="capitalize">
                                {p.type === 'raw' ? 'Raw Data' : 'Derived'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{p.dataSource}</TableCell>
                          <TableCell className="text-xs">{p.frequency}</TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setCurrent(p); setIsAdding(true); }}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(p.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          No parameters defined in this category.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Parameter Configuration</DialogTitle>
            <DialogDescription>Configure the analytical logic and source metadata for this factor.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Parameter Name</label>
                    <Input value={current.name} onChange={e => handleNameChange(e.target.value)} placeholder="e.g. Debt to GDP" />
                </div>
                <div className="grid gap-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                        Internal Slug <Code className="w-3 h-3" />
                    </label>
                    <Input value={current.slug} onChange={e => setCurrent({...current, slug: e.target.value})} placeholder="debt_to_gdp" className="font-mono" />
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Category</label>
                <Select value={current.category} onValueChange={v => setCurrent({...current, category: v as any})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Analytical Type</label>
                <Select value={current.type} onValueChange={v => setCurrent({...current, type: v as any, formula: v === 'raw' ? undefined : current.formula})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raw">Raw Data</SelectItem>
                    <SelectItem value="derived">Derived (Formula)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {current.type === "derived" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Calculation Formula</label>
                    <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                  </div>
                  <Input 
                    value={current.formula || ""} 
                    onChange={e => setCurrent({...current, formula: e.target.value})} 
                    placeholder="e.g. debt / gdp"
                    className="font-mono text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">Use parameter <b>slugs</b> in your expression.</p>
                </div>
                
                <div className="grid gap-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Dependent Parameters</label>
                  <Card className="bg-muted/20">
                    <ScrollArea className="h-[120px] p-2">
                      <div className="space-y-2">
                        {params.filter(p => p.id !== current.id).map(p => (
                          <div key={p.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`dep-${p.id}`}
                              checked={current.dependentParameters?.includes(p.id)}
                              onCheckedChange={() => toggleDependency(p.id)}
                            />
                            <label htmlFor={`dep-${p.id}`} className="text-xs cursor-pointer truncate flex items-center gap-2">
                              {p.name} <span className="text-muted-foreground opacity-50 font-mono">({p.slug})</span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </Card>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Data Source</label>
                <Select value={current.dataSource} onValueChange={v => setCurrent({...current, dataSource: v as any})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IMF (Auto)">IMF (Auto)</SelectItem>
                    <SelectItem value="World Bank (Auto)">World Bank (Auto)</SelectItem>
                    <SelectItem value="Manual">Manual</SelectItem>
                    <SelectItem value="Semi-Auto (Editable)">Semi-Auto (Editable)</SelectItem>
                    <SelectItem value="Computed">Computed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Reporting Frequency</label>
                <Select value={current.frequency} onValueChange={v => setCurrent({...current, frequency: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Annual">Annual</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-primary">Save Parameter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
