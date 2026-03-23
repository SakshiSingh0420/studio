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
import { Plus, Trash2, Edit2, Info, Code } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

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

  // Auto-generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove non-alphanumeric
      .replace(/[-\s]+/g, '_')   // Spaces/hyphens to underscores
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

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Parameter Master</h1>
          <p className="text-muted-foreground mt-1">Define the analytical factors used across all rating models.</p>
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

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Identifier (Slug)</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {params.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs text-primary">{p.slug}</TableCell>
                  <TableCell className="font-semibold">{p.name}</TableCell>
                  <TableCell><Badge variant="secondary">{p.category}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={p.type === 'derived' ? 'outline' : 'default'} className="capitalize">
                        {p.type === 'raw' ? 'Raw Data' : 'Derived'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.dataSource}</TableCell>
                  <TableCell className="text-xs">{p.frequency}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => { setCurrent(p); setIsAdding(true); }}><Edit2 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {params.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No parameters defined. Create one to begin.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Parameter Configuration</DialogTitle>
            <DialogDescription>Define the metadata and logic for this analytical factor.</DialogDescription>
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
                    {["Economic", "Fiscal", "External", "Monetary", "Institutional", "ESG"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
