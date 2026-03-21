"use client"

import { useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Globe, ShieldCheck, Clock, TrendingUp, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase"
import { collection, query, orderBy, limit } from "firebase/firestore"
import { Country, Rating } from "@/lib/store"

export default function DashboardPage() {
  const db = useFirestore();

  // Real-time countries collection
  const countriesQuery = useMemoFirebase(() => collection(db, 'countries'), [db]);
  const { data: countries, isLoading: loadingCountries } = useCollection<Country>(countriesQuery);

  // Real-time ratings (Recent activity)
  // Note: Adjusting query to fetch from top-level if ratings are flat, 
  // or use collectionGroup if nested. Assuming top-level for dashboard overview.
  const recentRatingsQuery = useMemoFirebase(() => 
    query(collection(db, 'ratings'), orderBy('createdAt', 'desc'), limit(5)), 
  [db]);
  const { data: recentRatingsData } = useCollection<Rating>(recentRatingsQuery);

  // Total ratings count for stats
  const allRatingsQuery = useMemoFirebase(() => collection(db, 'ratings'), [db]);
  const { data: allRatings } = useCollection<Rating>(allRatingsQuery);

  // Logging for debugging as requested
  useEffect(() => {
    if (countries) {
      console.log("Firestore Data - Countries:", countries);
    }
  }, [countries]);

  useEffect(() => {
    if (recentRatingsData) {
      console.log("Firestore Data - Recent Ratings:", recentRatingsData);
    }
  }, [recentRatingsData]);

  const stats = {
    countries: countries?.length || 0,
    ratings: allRatings?.length || 0,
    pending: allRatings?.filter(r => r.approvalStatus === 'pending').length || 0,
    averageScore: allRatings && allRatings.length > 0 
      ? (allRatings.reduce((acc, r) => acc + (r.finalScore || 0), 0) / allRatings.length) 
      : 0
  }

  const recentRatings = (recentRatingsData || []).map(r => ({
    ...r,
    countryName: countries?.find(c => c.id === r.countryId)?.name || 'Unknown'
  }))

  if (loadingCountries) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Sovereign Analytics Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-lg">Real-time overview of global credit ratings and risk profiles.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="metric-card border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Active Portfolio</CardTitle>
            <Globe className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.countries} Countries</div>
            <p className="text-xs text-muted-foreground">Managed in live Firestore repository</p>
          </CardContent>
        </Card>
        <Card className="metric-card border-l-4 border-l-accent">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Ratings Conducted</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.ratings} Sessions</div>
            <p className="text-xs text-muted-foreground">Across multiple analytical models</p>
          </CardContent>
        </Card>
        <Card className="metric-card border-l-4 border-l-yellow-400">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending} Ratings</div>
            <p className="text-xs text-muted-foreground">Awaiting committee validation</p>
          </CardContent>
        </Card>
        <Card className="metric-card border-l-4 border-l-green-400">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Avg. Confidence</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageScore.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Portfolio weighted average</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Sovereign Portfolio Registry</CardTitle>
            <CardDescription>Direct view of countries synchronized from Firestore.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table className="financial-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">GDP (Billions)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(countries || []).map((country) => (
                  <TableRow key={country.id}>
                    <TableCell className="font-bold">{country.name}</TableCell>
                    <TableCell>{country.region}</TableCell>
                    <TableCell className="text-right font-mono">${country.gdp}B</TableCell>
                  </TableRow>
                ))}
                {(!countries || countries.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      No countries found. Add some in the Console or via the Countries page.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates from the analytical team.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentRatings.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">No recent rating activity.</p>
              ) : recentRatings.map((r, i) => (
                <div key={r.id || i} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors border">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{r.countryName}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleDateString() : 'Real-time update'}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={r.approvalStatus === 'approved' ? 'default' : 'secondary'}>
                        {r.overrideRating || r.adjustedRating || r.initialRating}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
