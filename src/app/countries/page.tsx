"use client"

import { useState, useEffect } from "react"
import { Plus, Search, MapPin, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { addCountry, Country } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase"
import { collection } from "firebase/firestore"
import Link from "next/link"

export default function CountriesPage() {
  const db = useFirestore();
  const countriesQuery = useMemoFirebase(() => collection(db, 'countries'), [db]);
  const { data: countries, isLoading } = useCollection<Country>(countriesQuery);

  const [search, setSearch] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [newCountry, setNewCountry] = useState({
    name: "",
    region: "",
    incomeGroup: "Middle",
    currency: "USD",
    population: 0,
    gdp: 0
  })

  const handleAdd = async () => {
    if (!newCountry.name || !newCountry.region) return;
    await addCountry(newCountry)
    setIsAdding(false)
    setNewCountry({
      name: "",
      region: "",
      incomeGroup: "Middle",
      currency: "USD",
      population: 0,
      gdp: 0
    })
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
          <p className="text-muted-foreground mt-1">Manage geopolitical data and economic profiles.</p>
        </div>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> Add Country
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Register New Country</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Country Name</label>
                <Input value={newCountry.name} onChange={e => setNewCountry({...newCountry, name: e.target.value})} placeholder="e.g. India, USA, France" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Region</label>
                <Input value={newCountry.region} onChange={e => setNewCountry({...newCountry, region: e.target.value})} placeholder="e.g. South Asia, North America" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <label className="text-sm font-medium">Population (M)</label>
                    <Input type="number" value={newCountry.population} onChange={e => setNewCountry({...newCountry, population: Number(e.target.value)})} />
                </div>
                <div className="grid gap-2">
                    <label className="text-sm font-medium">GDP (Billions USD)</label>
                    <Input type="number" value={newCountry.gdp} onChange={e => setNewCountry({...newCountry, gdp: Number(e.target.value)})} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAdd}>Create Record</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
                className="pl-10" 
                placeholder="Search countries or regions..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
            />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(country => (
          <Card key={country.id} className="metric-card overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl font-bold">{country.name}</CardTitle>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" /> {country.region}
                  </p>
                </div>
                <Badge variant="outline">{country.currency}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold">Population</p>
                  <p className="font-medium">{country.population}M</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold">GDP</p>
                  <p className="font-medium">${country.gdp}B</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs uppercase font-semibold">Income Group</p>
                  <p className="font-medium">{country.incomeGroup}</p>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t flex gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link href={`/rate/${country.id}`}>
                    Execute Rating
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="flex-1">
                  <Link href={`/countries/${country.id}`}>
                    View Details
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && !isLoading && (
          <div className="col-span-full py-20 text-center border-2 border-dashed rounded-lg bg-muted/20">
            <p className="text-muted-foreground">No countries found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  )
}
