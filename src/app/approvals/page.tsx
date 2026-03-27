
"use client"

import { useState, useEffect } from "react"
import { getCountries, updateRatingStatus, Rating, Country } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { CheckCircle, XCircle, Eye, ShieldAlert, Loader2 } from "lucide-react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { useFirestore } from "@/firebase"

const DEMO_COUNTRIES: Partial<Country>[] = [
  { id: 'demo-in', name: "India", region: "Asia" },
  { id: 'demo-us', name: "United States", region: "North America" },
  { id: 'demo-cn', name: "China", region: "Asia" },
  { id: 'demo-de', name: "Germany", region: "Europe" },
  { id: 'demo-br', name: "Brazil", region: "South America" },
  { id: 'demo-za', name: "South Africa", region: "Africa" },
];

export default function ApprovalsPage() {
  const [pending, setPending] = useState<(Rating & { countryName: string })[]>([])
  const [selectedRating, setSelectedRating] = useState<any>(null)
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const db = useFirestore()

  async function load() {
    setLoading(true)
    try {
      // 1. Fetch all countries (DB)
      const dbCountries = await getCountries()
      
      // 2. Merge with Demo Countries for lookup
      const allSovereigns = [
        ...dbCountries,
        ...DEMO_COUNTRIES.filter(d => !dbCountries.some(c => c.name === d.name))
      ]

      // 3. Query ALL ratings with pending status directly
      const q = query(collection(db, 'ratings'), where('approvalStatus', '==', 'pending'))
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

      // Sort by creation date
      setPending(results.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0)
        const dateB = b.createdAt?.toDate?.() || new Date(0)
        return dateB.getTime() - dateA.getTime()
      }))
    } catch (error) {
      console.error("Failed to load approvals:", error)
      toast({ variant: "destructive", title: "Sync Error", description: "Could not retrieve the committee queue." })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleAction = async (status: 'approved' | 'rejected') => {
    if (!selectedRating) return
    try {
      await updateRatingStatus(selectedRating.id, status, undefined, reason)
      toast({ title: `Rating ${status.toUpperCase()}`, description: `Action successful for ${selectedRating.countryName}` })
      setSelectedRating(null)
      setReason("")
      load()
    } catch (e) {
      toast({ variant: "destructive", title: "Action Failed", description: "Could not update the rating status." })
    }
  }

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Analytical Committee Approval</h1>
        <p className="text-muted-foreground mt-1">Review and finalize ratings before official publication.</p>
      </div>

      <div className="grid gap-6">
        {pending.length === 0 ? (
            <Card className="border-2 border-dashed bg-muted/20">
                <CardContent className="flex flex-col items-center justify-center py-20 space-y-4">
                    <CheckCircle className="w-12 h-12 text-green-500 opacity-50" />
                    <p className="text-muted-foreground font-medium">All ratings are finalized. No pending items found.</p>
                </CardContent>
            </Card>
        ) : (
            <Card>
                <CardHeader>
                    <CardTitle>Pending Queue</CardTitle>
                    <CardDescription>Items in this list require committee oversight and signature.</CardDescription>
                </CardHeader>
                <CardContent>
                <Table className="financial-table">
                    <TableHeader>
                    <TableRow>
                        <TableHead>Sovereign</TableHead>
                        <TableHead>Proposed Rating</TableHead>
                        <TableHead>Confidence Score</TableHead>
                        <TableHead>Analyst Justification</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {pending.map((rating) => (
                        <TableRow key={rating.id}>
                        <TableCell className="font-bold">{rating.countryName}</TableCell>
                        <TableCell>
                            <Badge className="bg-primary">{rating.overrideRating || rating.adjustedRating || rating.initialRating}</Badge>
                        </TableCell>
                        <TableCell className="font-mono">{rating.finalScore.toFixed(1)}%</TableCell>
                        <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                            {rating.reason || 'No narrative provided.'}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                            <Button variant="outline" size="sm" onClick={() => setSelectedRating(rating)}>
                                <Eye className="w-4 h-4 mr-2" /> Review
                            </Button>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>
        )}
      </div>

      <Dialog open={!!selectedRating} onOpenChange={() => setSelectedRating(null)}>
          <DialogContent className="max-w-2xl">
              <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-primary" />
                      Rating Review: {selectedRating?.countryName}
                  </DialogTitle>
                  <DialogDescription>
                      Carefully review the analyst's rationale and quantitative metrics before signing off.
                  </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
                      <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Target Rating</p>
                          <p className="text-2xl font-bold">{selectedRating?.overrideRating || selectedRating?.adjustedRating || selectedRating?.initialRating}</p>
                      </div>
                      <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Quantitative Score</p>
                          <p className="text-2xl font-bold">{selectedRating?.finalScore.toFixed(1)}%</p>
                      </div>
                  </div>
                  <div className="space-y-2">
                      <p className="text-sm font-semibold">Analytical Rationale</p>
                      <div className="p-3 bg-muted/20 border rounded text-xs leading-relaxed max-h-[200px] overflow-auto">
                          {selectedRating?.reason || 'No rationale available.'}
                      </div>
                  </div>
                  <div className="space-y-2 pt-4">
                      <p className="text-sm font-semibold">Committee Comments</p>
                      <Textarea 
                        placeholder="Provide feedback or justification for the final decision..." 
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                      />
                  </div>
              </div>
              <DialogFooter className="flex gap-2">
                  <Button variant="destructive" className="flex-1" onClick={() => handleAction('rejected')}>
                      <XCircle className="w-4 h-4 mr-2" /> Reject & Return
                  </Button>
                  <Button variant="default" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleAction('approved')}>
                      <CheckCircle className="w-4 h-4 mr-2" /> Approve & Publish
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  )
}
