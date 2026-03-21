"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Globe, ShieldCheck, Clock, TrendingUp } from "lucide-react"
import { getCountries, getRatingHistory, Country, Rating } from "@/lib/store"
import { Badge } from "@/components/ui/badge"

export default function DashboardPage() {
  const [stats, setStats] = useState({
    countries: 0,
    ratings: 0,
    pending: 0,
    averageScore: 0
  })
  const [recentRatings, setRecentRatings] = useState<any[]>([])

  useEffect(() => {
    async function loadData() {
      const countries = await getCountries()
      // This is a simplified fetch for the dashboard
      const allRatings: Rating[] = []
      for (const c of countries) {
          const h = await getRatingHistory(c.id)
          allRatings.push(...h)
      }

      setStats({
        countries: countries.length,
        ratings: allRatings.length,
        pending: allRatings.filter(r => r.approvalStatus === 'pending').length,
        averageScore: allRatings.length > 0 ? (allRatings.reduce((acc, r) => acc + r.finalScore, 0) / allRatings.length) : 0
      })

      const sorted = [...allRatings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)
      setRecentRatings(sorted.map(r => ({
          ...r,
          countryName: countries.find(c => c.id === r.countryId)?.name || 'Unknown'
      })))
    }
    loadData()
  }, [])

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
            <p className="text-xs text-muted-foreground">Mapped in central repository</p>
          </CardContent>
        </Card>
        <Card className="metric-card border-l-4 border-l-accent">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Ratings Conducted</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.ratings} Sessions</div>
            <p className="text-xs text-muted-foreground">Across multiple models</p>
          </CardContent>
        </Card>
        <Card className="metric-card border-l-4 border-l-yellow-400">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending} Ratings</div>
            <p className="text-xs text-muted-foreground">Awaiting committee sign-off</p>
          </CardContent>
        </Card>
        <Card className="metric-card border-l-4 border-l-green-400">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Avg. Confidence</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageScore.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Platform average score</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
            <CardDescription>Visual breakdown of current sovereign health across mapped countries.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center bg-muted/20 rounded-lg m-6 border-2 border-dashed">
            <span className="text-muted-foreground font-medium">Interactive Heatmap & Charting Hub</span>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest rating updates from the analytical team.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentRatings.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">No recent activity found.</p>
              ) : recentRatings.map((r, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors border">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{r.countryName}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</p>
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