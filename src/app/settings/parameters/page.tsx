
"use client"

import { useState, useEffect } from "react"
import { getParameters, saveParameter, deleteParameter } from "@/lib/store"
import { Parameter } from "@/lib/rating-engine"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Edit2, Database } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function ParameterMasterPage() {
  const [params, setParams] = useState<Parameter[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [current, setCurrent] = useState<Partial<Parameter>>({
    name: "",
    category: "Economic",
    type: "raw",
    dataSource: "Manual",
    frequency: "Annual"
  })
  const { toast } = useToast()

  const load = async () => setParams(await getParameters())
  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!current.name) return
    await saveParameter(current as Parameter)
    setIsAdding(false)
    setCurrent({ name: "", category: "Economic", type: "raw", dataSource: "Manual", frequency: "Annual" })
    load()
    toast({ title: "Parameter Saved" })
  }

  const handleDelete = async (id: string) => {
    await deleteParameter(id)
    load()
    toast({ title: "Parameter Deleted", variant: "destructive" })
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Parameter Master</h1>
          <p className="text-muted-foreground mt-1">Define the analytical factors used across all rating models.</p>
        </div>
        <Button onClick={() => setIsAdding(true)}><Plus className="w-4 h-4 mr-2" /> Define Parameter</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell className="font-semibold">{p.name}</TableCell>
                  <TableCell><Badge variant="secondary">{p.category}</Badge></TableCell>
                  <TableCell className="capitalize">{p.type}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.dataSource}</TableCell>
                  <TableCell className="text-xs">{p.frequency}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => { setCurrent(p); setIsAdding(true); }}><Edit2 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent>
          <DialogHeader><DialogTitle>Parameter Configuration</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase">Name</label>
              <Input value={current.name} onChange={e => setCurrent({...current, name: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase">Category</label>
                <Select value={current.category} onValueChange={v => setCurrent({...current, category: v as any})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Economic", "Fiscal", "External", "Monetary", "Institutional", "ESG"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase">Type</label>
                <Select value={current.type} onValueChange={v => setCurrent({...current, type: v as any})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raw">Raw</SelectItem>
                    <SelectItem value="derived">Derived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase">Data Source</label>
              <Input value={current.dataSource} onChange={e => setCurrent({...current, dataSource: e.target.value})} placeholder="e.g. IMF, World Bank, Manual" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Parameter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
