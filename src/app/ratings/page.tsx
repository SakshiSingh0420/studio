
"use client"

import { useState, useEffect } from "react"
import { getCountries, Rating, resetAllRatings, getModels } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Download, ExternalLink, RotateCcw, Clock, AlertCircle, FileText, ChevronRight } from "lucide-react"
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
import { collection, getDocs, query, orderBy, where } from "firebase/firestore"
import { useFirestore } from "@/firebase"
import Link from "next/link"

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

      // 2. Query APPROVED ratings directly from the collection
      const q = query(
        collection(db, 'ratings'), 
        where('approvalStatus', '==', 'approved'),
        orderBy('createdAt', 'desc')
      )
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
          <h1 className="text-3xl font-black tracking-tighter text-slate-900">Rating Archive</h1>
          <p className="text-muted-foreground mt-1 text-lg">Official audit trail of finalized sovereign credit designations.</p>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 h-10 px-4" suppressHydrationWarning>
                <RotateCcw className="w-4 h-4 mr-2" /> Reset Ledger
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action will permanently delete all historical rating results and version snapshots. Sovereign registries and analytical models will NOT be affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Yes, Clear Archive
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" size="sm" className="h-10 px-4" suppressHydrationWarning>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      <Card className="border-2 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b pb-6 px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-black text-slate-900">Historical Ledger</CardTitle>
              <CardDescription className="font-medium text-slate-500">Database of point-in-time quantitative scores and analyst overrides.</CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-10 h-11 border-2 focus:border-primary transition-all"
                placeholder="Search sovereigns or ratings..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                suppressHydrationWarning
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Clock className="w-10 h-10 animate-spin text-primary opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Syncing analytical archive...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 border-b">
              <FileText className="w-12 h-12 text-slate-200 mb-4" />
              <p className="text-slate-500 font-bold">No finalized rating versions found.</p>
              <p className="text-xs text-slate-400 mt-1">Pending ratings appear here once they are approved by the committee.</p>
            </div>
          ) : (
            <Table className="financial-table">
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="px-8 font-black uppercase text-[10px] text-slate-500 tracking-widest">Sovereign Entity</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-slate-500 tracking-widest text-center">Version</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-slate-500 tracking-widest text-center">Finalization Date</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-slate-500 tracking-widest">Model Framework</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-slate-500 tracking-widest text-center">Final Score</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-slate-500 tracking-widest text-center">Assigned Rating</TableHead>
                  <TableHead className="text-right px-8 font-black uppercase text-[10px] text-slate-500 tracking-widest">Audit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((rating) => (
                  <TableRow key={rating.id} className="hover:bg-slate-50/50 transition-colors group border-b last:border-0">
                    <TableCell className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 group-hover:text-primary transition-colors">{rating.countryName}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{rating.year} Cycle</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-5">
                      <Badge variant="outline" className="font-black text-[10px] border-slate-200">V{rating.version || 1}</Badge>
                    </TableCell>
                    <TableCell className="text-center py-5 text-xs font-bold text-slate-500" suppressHydrationWarning>
                      {rating.createdAt?.toDate ? rating.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', year: 'numeric', day: 'numeric' }) : 'N/A'}
                    </TableCell>
                    <TableCell className="py-5">
                      <Badge variant="secondary" className="font-bold text-[10px] uppercase bg-white border-2 border-slate-100">{getModelName(rating.modelId)}</Badge>
                    </TableCell>
                    <TableCell className="text-center py-5 font-black text-slate-900">{rating.finalScore.toFixed(1)}%</TableCell>
                    <TableCell className="text-center py-5">
                      <Badge className="font-black text-sm px-4 py-1.5 shadow-lg bg-slate-900 rounded-xl">
                        {rating.overrideRating || rating.adjustedRating || rating.initialRating}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-8 py-5">
                      <Button asChild variant="ghost" size="icon" className="h-10 w-10 hover:bg-primary/10 hover:text-primary rounded-xl" suppressHydrationWarning>
                        <Link href={`/ratings/${rating.id}`}>
                          <ChevronRight className="w-5 h-5" />
                        </Link>
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
