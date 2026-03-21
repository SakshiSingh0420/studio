"use client"

import { useState, useEffect } from "react"
import { getCountries, getRatingHistory, Rating, Country } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Filter, Download, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function RatingsHistoryPage() {
  const [ratings, setRatings] = useState<(Rating & { countryName: string })[]>([])
  const [search, setSearch] = useState("")

  useEffect(() => {
    async function load() {
      const countries = await getCountries()
      const all: any[] = []
      for (const c of countries) {
        const history = await getRatingHistory(c.id)
        all.push(...history.map(r => ({ ...r, countryName: c.name })))
      }
      setRatings(all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    }
    load()
  }, [])

  const filtered = ratings.filter(r => 
    r.countryName.toLowerCase().includes(search.toLowerCase()) ||
    r.initialRating.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Rating Archive</h1>
          <p className="text-muted-foreground mt-1">Audit trail of all sovereign credit rating sessions.</p>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" /> Export PDF Report
        </Button>
      </div>

      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Historical Ledger</CardTitle>
                    <CardDescription>Complete database of quantitative scores and qualitative overrides.</CardDescription>
                </div>
                <div className="flex items-center gap-2 max-w-sm">
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                            className="pl-10" 
                            placeholder="Filter by country or rating..." 
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <Button variant="ghost" size="icon">
                        <Filter className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </CardHeader>
        <CardContent>
          <Table className="financial-table">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
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
                  <TableCell className="font-mono text-xs">{new Date(rating.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="font-semibold">{rating.countryName}</TableCell>
                  <TableCell><Badge variant="outline">{rating.modelId.toUpperCase()}</Badge></TableCell>
                  <TableCell className="font-bold">{rating.finalScore.toFixed(1)}%</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground line-through text-xs">{rating.initialRating}</span>
                        <span className="font-bold text-primary">{rating.overrideRating || rating.adjustedRating || rating.initialRating}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={rating.approvalStatus === 'approved' ? 'default' : rating.approvalStatus === 'pending' ? 'secondary' : 'destructive'}>
                        {rating.approvalStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                        <ExternalLink className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                  <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          No historical ratings found. Execute a rating to begin tracking.
                      </TableCell>
                  </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}