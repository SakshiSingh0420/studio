
"use client"

import { useState } from "react"
import { Plus, Search, MapPin, Loader2, Calendar, Database, TrendingUp, DollarSign, Activity, Info, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
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
import { addCountry, Country, deleteCountry, getRatingHistory } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase"
import { collection } from "firebase/firestore"
import Link from "next/link"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"

export default function CountriesPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const countriesQuery = useMemoFirebase(() => collection(db, 'countries'), [db]);
  const { data: countries, isLoading } = useCollection<Country>(countriesQuery);

  const [search, setSearch] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [newCountry, setNewCountry] = useState<Partial<Country>>({
    name: "",
    region: "",
    incomeGroup: "Emerging",
    currency: "USD",
    population: 0,
    nominalGdp: 0,
    gdpPerCapita: 0,
    inflation: 0,
    dataYear: new Date().getFullYear(),
    primaryDataSource: "IMF",
    equityIndex: "",
    bondYield10Y: 0,
    fxRate: 1,
    scenarioName: "Base Case 2024"
  })

  const handleAdd = async () => {
    if (!newCountry.name || !newCountry.region || !newCountry.dataYear) return;
    if ((newCountry.nominalGdp || 0) <= 0 || (newCountry.population || 0) <= 0) return;
    
    await addCountry(newCountry)
    setIsAdding(false)
    setNewCountry({
      name: "",
      region: "",
      incomeGroup: "Emerging",
      currency: "USD",
      population: 0,
      nominalGdp: 0,
      gdpPerCapita: 0,
      inflation: 0,
      dataYear: new Date().getFullYear(),
      primaryDataSource: "IMF",
      equityIndex: "",
      bondYield10Y: 0,
      fxRate: 1,
      scenarioName: "Base Case 2024"
    })
    toast({ title: "Sovereign Registered", description: `${newCountry.name} has been added to the registry.` });
  }

  const handleDelete = async (countryId: string, countryName: string) => {
    try {
      const history = await getRatingHistory(countryId);
      if (history.length > 0) {
        toast({ 
          title: "Deletion Prohibited", 
          description: "Cannot delete country with existing rating history. Clear history first.",
          variant: "destructive"
        });
        return;
      }

      await deleteCountry(countryId);
      toast({ title: "Sovereign Removed", description: `${countryName} has been deleted from the registry.` });
    } catch (error) {
      console.error("Delete Error:", error);
      toast({ title: "Error", description: "Could not complete the deletion process.", variant: "destructive" });
    }
  }

  const filtered = (countries || []).filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.region.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Sovereign Entities</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage geopolitical data and economic profiles for analytical modeling.</p>
        </div>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 font-bold shadow-md">
              <Plus className="w-4 h-4 mr-2" /> Register Sovereign
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Register New Sovereign Profile</DialogTitle>
              <CardDescription>Populate core macroeconomic and market context for the rating framework.</CardDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
                <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground">Country Name</label>
                        <Input value={newCountry.name} onChange={e => setNewCountry({...newCountry, name: e.target.value})} placeholder="e.g. India" />
                    </div>
                    <div className="grid gap-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground">Region</label>
                        <Input value={newCountry.region} onChange={e => setNewCountry({...newCountry, region: e.target.value})} placeholder="e.g. South Asia" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground">Market Classification</label>
                        <Select onValueChange={v => setNewCountry({...newCountry, incomeGroup: v as any})} value={newCountry.incomeGroup}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Advanced">Advanced</SelectItem>
                                <SelectItem value="Emerging">Emerging</SelectItem>
                                <SelectItem value="Frontier">Frontier</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground">Data Year</label>
                        <Input type="number" value={newCountry.dataYear} onChange={e => setNewCountry({...newCountry, dataYear: Number(e.target.value)})} />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground">Nom. GDP ($B)</label>
                        <Input type="number" value={newCountry.nominalGdp} onChange={e => setNewCountry({...newCountry, nominalGdp: Number(e.target.value)})} />
                    </div>
                    <div className="grid gap-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground">Pop. (M)</label>
                        <Input type="number" value={newCountry.population} onChange={e => setNewCountry({...newCountry, population: Number(e.target.value)})} />
                    </div>
                    <div className="grid gap-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground">Inflation (%)</label>
                        <Input type="number" step="0.1" value={newCountry.inflation} onChange={e => setNewCountry({...newCountry, inflation: Number(e.target.value)})} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="grid gap-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground">Equity Index</label>
                        <Input value={newCountry.equityIndex} onChange={e => setNewCountry({...newCountry, equityIndex: e.target.value})} placeholder="e.g. Sensex" />
                    </div>
                    <div className="grid gap-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground">10Y Bond Yield (%)</label>
                        <Input type="number" step="0.01" value={newCountry.bondYield10Y} onChange={e => setNewCountry({...newCountry, bondYield10Y: Number(e.target.value)})} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground">Primary Source</label>
                        <Select onValueChange={v => setNewCountry({...newCountry, primaryDataSource: v})} value={newCountry.primaryDataSource}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="IMF">IMF</SelectItem>
                                <SelectItem value="World Bank">World Bank</SelectItem>
                                <SelectItem value="National Source">National Source</SelectItem>
                                <SelectItem value="Manual">Manual Entry</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground">Scenario Name</label>
                        <Input value={newCountry.scenarioName} onChange={e => setNewCountry({...newCountry, scenarioName: e.target.value})} />
                    </div>
                </div>
                </div>
            </ScrollArea>
            <DialogFooter>
              <Button onClick={handleAdd} className="w-full font-bold">Initialize Sovereign Record</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
                className="pl-10 h-11 border-2" 
                placeholder="Search sovereigns or regional hubs..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
            />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(country => (
          <Card key={country.id} className="metric-card overflow-hidden border-2 hover:border-primary transition-all group relative">
            <CardHeader className="bg-slate-50/50 pb-4 border-b">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-black tracking-tight text-slate-900 group-hover:text-primary transition-colors">{country.name}</CardTitle>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                    <MapPin className="w-3 h-3" /> {country.region}
                    <span className="text-slate-300">|</span>
                    <span>{country.incomeGroup} Market</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono bg-white border-2">{country.currency}</Badge>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Sovereign Profile?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove <b>{country.name}</b> from the registry? This action is permanent. 
                          <br/><br/>
                          Note: Deletion is only allowed if no rating history exists for this country.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleDelete(country.id, country.name)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete Permanently
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> Nom. GDP
                  </p>
                  <p className="text-lg font-black text-slate-900">${country.nominalGdp}B</p>
                  <p className="text-[9px] font-bold text-slate-500">FY {country.dataYear}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Population</p>
                  <p className="text-lg font-black text-slate-900">{country.population}M</p>
                  <p className="text-[9px] font-bold text-slate-500">{country.scenarioName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Inflation
                  </p>
                  <p className="text-lg font-black text-slate-900">{country.inflation}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Bond Yield
                  </p>
                  <p className="text-lg font-black text-slate-900">{country.bondYield10Y}%</p>
                </div>
              </div>

              <div className="pt-4 border-t flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                        <Database className="w-3 h-3" /> Source: <Badge variant="secondary" className="px-1.5 h-4 text-[9px] font-black">{country.primaryDataSource}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 italic">
                        <Calendar className="w-3 h-3" /> 
                        Updated: {country.lastUpdated ? new Date(country.lastUpdated.seconds * 1000).toLocaleDateString() : 'Real-time'}
                    </div>
                </div>
                <Button asChild className="w-full bg-slate-900 font-bold h-11 shadow-lg hover:shadow-xl transition-all">
                  <Link href={`/rate/${country.id}`}>
                    Initiate Rating Execution
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && !isLoading && (
          <div className="col-span-full py-24 text-center border-2 border-dashed rounded-3xl bg-slate-50">
            <Info className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-bold text-lg">No sovereigns found matching your active filter.</p>
            <p className="text-slate-400 text-sm mt-1">Refine your search parameters or register a new geopolitical entity.</p>
          </div>
        )}
      </div>
    </div>
  )
}
