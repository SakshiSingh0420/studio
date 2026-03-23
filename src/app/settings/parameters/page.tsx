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
import { Plus, Trash2, Edit2, Info, Code, Layers, Search, XCircle, Filter } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const CATEGORIES = ["Economic", "Fiscal", "External", "Monetary", "Institutional", "ESG"] as const;
const SOURCES = ["IMF (Auto)", "World Bank (Auto)", "Manual", "Semi-Auto (Editable)", "Computed"] as const;

export default function ParameterMasterPage() {
  const [params, setParams] = useState<Parameter[]>([])
  const [isAdding, setIsAdding] = useState(false)
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all")

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

  // Filtering Logic
  const filteredParams = params.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.slug.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
    const matchesType = typeFilter === "all" || p.type === typeFilter;
    const matchesSource = sourceFilter === "all" || p.dataSource === sourceFilter;
    
    return matchesSearch && matchesCategory && matchesType && matchesSource;
  })

  const resetFilters = () => {
    setSearchTerm("")
    setCategoryFilter("all")
    setTypeFilter("all")
    setSourceFilter("all")
  }

  const groupedParams = CATEGORIES.reduce((acc, cat) => {
    // Only show categories if they match the category filter or if filter is "all"
    if (categoryFilter === "all" || categoryFilter === cat) {
      acc[cat] = filteredParams
        .filter(p => p.category === cat)
        .sort((a, b) => a.name.localeCompare(b.name));
    } else {
      acc[cat] = [];
    }
    return acc;
  }, {} as Record<string, Parameter[]>);

  const activeFilterCount = (searchTerm ? 1 : 0) + 
                           (categoryFilter !== "all" ? 1 : 0) + 
                           (typeFilter !== "all" ? 1 : 0) + 
                           (sourceFilter !== "all" ? 1 : 0);

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

      <Card className="bg-muted/30 border-none shadow-none">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name or slug..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="raw">Raw Data</SelectItem>
                  <SelectItem value="derived">Derived</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>

              {activeFilterCount > 0 && (
                <Button variant="ghost" onClick={resetFilters} className="text-muted-foreground">
                  <XCircle className="w-4 h-4 mr-2" /> Clear
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <div className="flex items-center gap-2">
              <Filter className="w-3 h-3" />
              <span>Showing <b>{filteredParams.length}</b> of {params.length} parameters</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Accordion type="multiple" defaultValue={CATEGORIES as any} className="w-full space-y-4">
          {CATEGORIES.map((category) => {
            const categoryParams = groupedParams[category] || [];
            if (categoryFilter !== "all" && categoryFilter !== category) return null;
            if (categoryParams.length === 0 && activeFilterCount > 0) return null;

            return (
              <AccordionItem key={category} value={category} className="border rounded-lg bg-card px-4 shadow-sm">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <Layers className="w-5 h-5 text-primary opacity-70" />
                    <span className="text-lg font-semibold">{category}</span>
                    <Badge variant="secondary" className="ml-2">
                      {categoryParams.length} Factors
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
                      {categoryParams.length > 0 ? (
                        categoryParams.map(p => (
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
                            No parameters found matching filters.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
        
        {filteredParams.length === 0 && activeFilterCount > 0 && (
          <div className="py-20 text-center border-2 border-dashed rounded-lg bg-muted/20">
            <Search className="w-10 h-10 text-muted-foreground opacity-20 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">No parameters match your search criteria.</p>
            <Button variant="link" onClick={resetFilters} className="mt-2">Clear all filters</Button>
          </div>
        )}
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
                    {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
