
"use client"

import { useState, useEffect } from "react"
import { getCountries, Rating, resetAllRatings, getModels } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Download, ExternalLink, RotateCcw, Clock, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
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
import { collection, getDocs, query, orderBy } from "firebase/firestore"
import { useFirestore } from "@/firebase"

const DEMO_COUNTRIES = [
  { id: 'demo-in', name: "India" },
  { id: 'demo-us', name: "United States" },
  { id: 'demo-cn', name: "China" },
  { id: 'demo-de', name: "Germany" },
  { id: 'demo-br', name: "Brazil" },
  { id: 'demo-za', name: "South Africa" }
]

export default function RatingsHistoryPage() {
  const [ratings, setRatings] = useState<(Rating & { countryName: string })[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [models, setModels] = useState<any[]>([])
  const { toast } = useToast()
  const db = useFirestore()

  async function load() {
    setLoading(true)
    try {
      // 1. Fetch Master Data
      const [dbCountries, modelList] = await Promise.all([
        getCountries(),
        getModels()
      ])
      
      setModels(modelList)
      
      const allSovereigns = [
        ...dbCountries,
        ...DEMO_COUNTRIES.filter(d => !dbCountries.some(c => c.name === d.name))
      ]

      // 2. Query ALL ratings directly from the collection
      const q = query(collection(db, 'ratings'), orderBy('createdAt', 'desc'))
      const snap = await getDocs(q)
      
      const results = snap.docs.map(doc => {
        const data = doc.data() as Rating
        const country = allSovereigns.find(c => c.id === data.countryId)
        return {
          ...data,
          id: doc.id,
          countryName: country?.name || 'Unknown Sovereign'
        }
      })

      setRatings(results)
    } catch (error) {
      console.error("Failed to load rating history:", error)
      toast({ 
        variant: "destructive", 
        title: "Sync Error", 
        description: "Could not retrieve the rating archive." 
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleReset = async () => {
    try {
      await resetAllRatings();
      toast({ title: "Data Reset Complete", description: "All historical rating sessions have been cleared." });
      load();
    } catch (e) {
      toast({ title: "Reset Failed", variant: "destructive" });
    }
  }

  const filtered = ratings.filter(r =>
    r.countryName.toLowerCase().includes(search.toLowerCase()) ||
    r.initialRating.toLowerCase().includes(search.toLowerCase())
  )

  const getModelName = (modelId: string) => {
    const model = models.find(m => m.id === modelId)
    return model?.name || modelId
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Rating Archive</h1>
          <p className="text-muted-foreground mt-1">Audit trail of all sovereign credit rating sessions.</p>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive hover:bg-destructive/10" suppressHydrationWarning>
                <RotateCcw className="w-4 h-4 mr-2" /> Reset All Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action will permanently delete all historical rating results and dashboard data. Country registries, analytical models, and scales will NOT be affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Yes, Clear History
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" suppressHydrationWarning>
            <Download className="w-4 h-4 mr-2" /> Export PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Historical Ledger</CardTitle>
              <CardDescription>Complete database of quantitative scores and qualitative overrides.</CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Filter by country or rating..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                suppressHydrationWarning
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Clock className="w-10 h-10 animate-spin text-primary opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Syncing Ledger...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl bg-muted/10">
              <AlertCircle className="w-12 h-12 text-muted-foreground opacity-20 mb-4" />
              <p className="text-muted-foreground font-medium">No historical ratings found.</p>
            </div>
          ) : (
            <Table className="financial-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Sovereign Entity</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Assigned Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((rating) => (
                  <TableRow key={rating.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-xs font-bold text-primary">{rating.year || 'N/A'}</TableCell>
                    <TableCell className="font-semibold">{rating.countryName}</TableCell>
                    <TableCell><Badge variant="outline">{getModelName(rating.modelId)}</Badge></TableCell>
                    <TableCell className="font-bold">{rating.finalScore.toFixed(1)}%</TableCell>
                    <TableCell>
                      <span className="font-bold text-primary">{rating.overrideRating || rating.adjustedRating || rating.initialRating}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rating.approvalStatus === 'approved' ? 'default' : rating.approvalStatus === 'pending' ? 'secondary' : 'destructive'}>
                        {rating.approvalStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" suppressHydrationWarning>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
