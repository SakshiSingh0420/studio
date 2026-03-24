"use client"

import { useState, useEffect } from "react"
import { getScales, saveScale, deleteScale } from "@/lib/store"
import { RatingScale, RatingScaleEntry } from "@/lib/rating-engine"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Save, Scale, AlertCircle, CheckCircle2, ChevronRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
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

export default function RatingScalesPage() {
  const [scales, setScales] = useState<RatingScale[]>([])
  const [selectedScale, setSelectedScale] = useState<Partial<RatingScale> | null>(null)
  const { toast } = useToast()

  const load = async () => setScales(await getScales())
  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!selectedScale?.name) return
    if (!selectedScale.mapping || selectedScale.mapping.length === 0) {
      toast({ title: "Validation Error", description: "Scale must have at least one mapping entry.", variant: "destructive" })
      return
    }

    try {
      const cleanedData = { ...selectedScale }
      delete (cleanedData as any).id
      const savedId = await saveScale(cleanedData)
      
      if (!selectedScale.id) {
        setSelectedScale(prev => prev ? { ...prev, id: savedId } : null)
      }
      
      await load()
      toast({ title: "Rating Scale Saved", description: `"${selectedScale.name}" is now available for analytical use.` })
    } catch (error) {
      toast({ title: "Save Failed", description: "An error occurred while saving the scale.", variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    await deleteScale(id)
    if (selectedScale?.id === id) setSelectedScale(null)
    await load()
    toast({ title: "Scale Deleted" })
  }

  const addMappingRow = () => {
    const mapping = [...(selectedScale?.mapping || [])]
    mapping.push({ minScore: 0, maxScore: 10, rating: "NR" })
    setSelectedScale({ ...selectedScale, mapping })
  }

  const removeMappingRow = (index: number) => {
    const mapping = [...(selectedScale?.mapping || [])]
    mapping.splice(index, 1)
    setSelectedScale({ ...selectedScale, mapping })
  }

  const updateMappingRow = (index: number, field: keyof RatingScaleEntry, value: any) => {
    const mapping = [...(selectedScale?.mapping || [])]
    mapping[index] = { ...mapping[index], [field]: field === 'rating' ? value : Number(value) }
    setSelectedScale({ ...selectedScale, mapping })
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Rating Scales</h1>
          <p className="text-muted-foreground mt-1 text-lg">Define mapping tables for quantitative scores to credit ratings.</p>
        </div>
        <Button onClick={() => setSelectedScale({ name: "New Scale", mapping: [{ minScore: 90, maxScore: 100, rating: "AAA" }] })}>
          <Plus className="w-4 h-4 mr-2" /> Define New Scale
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-1 space-y-4">
          <Card className="bg-muted/10 border-none shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Standard Library</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {scales.map(s => (
                <div 
                  key={s.id} 
                  className={cn(
                    "group cursor-pointer p-3 rounded-lg border bg-card transition-all hover:border-primary",
                    selectedScale?.id === s.id && "border-primary ring-1 ring-primary shadow-sm"
                  )} 
                  onClick={() => setSelectedScale(s)}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">{s.mapping.length} Buckets</p>
                    </div>
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
                          <AlertDialogTitle>Delete Scale?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove the "{s.name}" scale. Existing historical ratings referencing this ID will remain intact but may lose label mapping context.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDelete(s.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
              {scales.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed rounded-lg bg-muted/20">
                  <p className="text-xs text-muted-foreground">No scales defined.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {selectedScale ? (
            <Card className="border-2">
              <CardHeader className="border-b bg-card">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Scale className="w-5 h-5 text-primary" />
                      Scale Configuration
                    </CardTitle>
                    <CardDescription>Map quantitative ranges to final credit designations.</CardDescription>
                  </div>
                  <Button onClick={handleSave} className="bg-primary shadow-lg hover:shadow-xl transition-all w-full lg:w-auto">
                    <Save className="w-4 h-4 mr-2" /> Save Scale
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Scale Name</label>
                  <Input 
                    value={selectedScale.name} 
                    onChange={e => setSelectedScale({...selectedScale, name: e.target.value})} 
                    className="font-bold text-lg" 
                    placeholder="e.g. Standard Moody's, Custom Numerical"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      Score Mapping
                      <span className="text-[10px] font-normal text-muted-foreground">(Scores are normalized 0-100)</span>
                    </h3>
                    <Button variant="outline" size="sm" onClick={addMappingRow}>
                      <Plus className="w-3 h-3 mr-1" /> Add Bucket
                    </Button>
                  </div>
                  
                  <Table className="border rounded-md overflow-hidden">
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Min Score (%)</TableHead>
                        <TableHead>Max Score (%)</TableHead>
                        <TableHead>Assigned Rating</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedScale.mapping?.map((entry, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Input 
                              type="number" 
                              value={entry.minScore} 
                              onChange={e => updateMappingRow(idx, 'minScore', e.target.value)}
                              className="h-8 font-mono"
                            />
                          </TableCell>
                          <TableCell>
                            <Input 
                              type="number" 
                              value={entry.maxScore} 
                              onChange={e => updateMappingRow(idx, 'maxScore', e.target.value)}
                              className="h-8 font-mono"
                            />
                          </TableCell>
                          <TableCell>
                            <Input 
                              value={entry.rating} 
                              onChange={e => updateMappingRow(idx, 'rating', e.target.value)}
                              className="h-8 font-bold text-primary"
                              placeholder="e.g. AA+"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeMappingRow(idx)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-700 leading-relaxed">
                    <p className="font-bold mb-1">Analytical Tip</p>
                    Ensure your score ranges (Min/Max) do not overlap and cover the full spectrum from 0 to 100 for consistent rating results during execution.
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="h-[500px] flex flex-col items-center justify-center border-2 border-dashed rounded-xl bg-muted/20">
              <Scale className="w-12 h-12 text-primary opacity-20 mb-4" />
              <p className="text-muted-foreground font-semibold">Select or create a rating scale.</p>
              <p className="text-xs text-muted-foreground mt-2">Map quantitative scores to qualitative credit symbols.</p>
              <Button variant="outline" className="mt-6" onClick={() => setSelectedScale({ name: "New Scale", mapping: [{ minScore: 90, maxScore: 100, rating: "AAA" }] })}>
                <Plus className="w-4 h-4 mr-2" /> Create Custom Scale
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
