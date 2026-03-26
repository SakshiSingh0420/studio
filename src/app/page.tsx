
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Globe, ShieldCheck, Clock, TrendingUp, Loader2, Filter, ChevronDown, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase"
import { collection, query, orderBy, limit } from "firebase/firestore"
import { Country, Rating } from "@/lib/store"
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine
} from "recharts"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function DashboardPage() {
  const db = useFirestore();
  const [selectedCountryIds, setSelectedCountryIds] = useState<string[]>([])

  // Real-time countries collection
  const countriesQuery = useMemoFirebase(() => collection(db, 'countries'), [db]);
  const { data: countries, isLoading: loadingCountries } = useCollection<Country>(countriesQuery);

  // Real-time ratings (Recent activity)
  const recentRatingsQuery = useMemoFirebase(() => 
    query(collection(db, 'ratings'), orderBy('createdAt', 'desc'), limit(5)), 
  [db]);
  const { data: recentRatingsData } = useCollection<Rating>(recentRatingsQuery);

  // Total ratings for history and stats
  const allRatingsQuery = useMemoFirebase(() => 
    query(collection(db, 'ratings'), orderBy('createdAt', 'asc')), 
  [db]);
  const { data: allRatings } = useCollection<Rating>(allRatingsQuery);

  // Default selection to first few countries if none selected
  useEffect(() => {
    if (countries && selectedCountryIds.length === 0 && countries.length > 0) {
      setSelectedCountryIds([countries[0].id])
    }
  }, [countries, selectedCountryIds.length])

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
    countryName: countries?.find(c => c.id === r.countryId)?.name || 'Unknown Sovereign'
  }))

  // Transform data for the line chart
  const transitionData = useMemo(() => {
    if (!allRatings || !countries) return []

    // Get all unique dates (formatted) across selected ratings
    const dates = Array.from(new Set(allRatings.map(r => {
      const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date();
      return d.toLocaleDateString();
    }))).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    // Map dates to country scores
    return dates.map(dateStr => {
      const entry: any = { date: dateStr };
      selectedCountryIds.forEach(cid => {
        const country = countries.find(c => c.id === cid);
        if (!country) return;

        // Find the rating for this country on this date, or the latest one before it
        const ratingOnDate = allRatings.find(r => {
          const rd = r.createdAt?.toDate ? r.createdAt.toDate() : new Date();
          return rd.toLocaleDateString() === dateStr && r.countryId === cid;
        });

        if (ratingOnDate) {
          entry[country.name] = ratingOnDate.finalScore;
        }
      });
      return entry;
    });
  }, [allRatings, countries, selectedCountryIds]);

  const toggleCountry = (id: string) => {
    setSelectedCountryIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  if (loadingCountries) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const chartColors = [
    "hsl(var(--primary))",
    "hsl(var(--accent))",
    "#10b981", // Emerald
    "#f59e0b", // Amber
    "#ef4444", // Red
    "#8b5cf6", // Violet
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900">Sovereign Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-lg">Real-time overview of global credit ratings and risk profiles.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="metric-card border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-black uppercase text-slate-500 tracking-wider">Active Portfolio</CardTitle>
            <Globe className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">{stats.countries} Countries</div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Managed in live repository</p>
          </CardContent>
        </Card>
        <Card className="metric-card border-l-4 border-l-accent">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-black uppercase text-slate-500 tracking-wider">Ratings Sessions</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">{stats.ratings} Conducted</div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Historical analytical sessions</p>
          </CardContent>
        </Card>
        <Card className="metric-card border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-black uppercase text-slate-500 tracking-wider">Committee Queue</CardTitle>
            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">{stats.pending} Pending</div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Awaiting validation</p>
          </CardContent>
        </Card>
        <Card className="metric-card border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-black uppercase text-slate-500 tracking-wider">Avg. Confidence</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">{stats.averageScore.toFixed(1)}%</div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Portfolio weighted aggregate</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-7 border-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50 border-b py-6 px-8">
            <div className="space-y-1">
              <CardTitle className="text-xl font-black text-slate-900">Sovereign Rating Transition Analytics</CardTitle>
              <CardDescription className="text-slate-500 font-medium">Comparative historical trend analysis of credit risk scores.</CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-2 font-bold h-10 px-4">
                  <Filter className="w-4 h-4 mr-2" /> 
                  Compare Sovereigns ({selectedCountryIds.length})
                  <ChevronDown className="ml-2 w-4 h-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Sovereign Entities</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {countries?.map(c => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={selectedCountryIds.includes(c.id)}
                    onCheckedChange={() => toggleCountry(c.id)}
                    className="font-medium"
                  >
                    {c.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent className="pt-10 pb-6">
            <div className="h-[400px] w-full">
              {transitionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={transitionData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                      dy={10}
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                      dx={-10}
                      label={{ value: 'Risk Score (%)', angle: -90, position: 'insideLeft', style: { fontWeight: 900, fontSize: 12, fill: '#1e293b' } }}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: '2px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                      labelStyle={{ fontWeight: 900, marginBottom: '8px', color: '#1e293b' }}
                      itemStyle={{ fontWeight: 700, fontSize: '12px' }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      height={36} 
                      iconType="circle"
                      wrapperStyle={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    />
                    {selectedCountryIds.map((cid, index) => {
                      const name = countries?.find(c => c.id === cid)?.name;
                      if (!name) return null;
                      return (
                        <Line
                          key={cid}
                          type="monotone"
                          dataKey={name}
                          stroke={chartColors[index % chartColors.length]}
                          strokeWidth={4}
                          dot={{ r: 6, strokeWidth: 2, fill: 'white' }}
                          activeDot={{ r: 8, strokeWidth: 0 }}
                          animationDuration={1500}
                        />
                      );
                    })}
                    <ReferenceLine y={80} label={{ value: 'Prime', position: 'right', fill: '#10b981', fontSize: 10, fontWeight: 900 }} stroke="#10b981" strokeDasharray="5 5" />
                    <ReferenceLine y={50} label={{ value: 'Inv. Grade', position: 'right', fill: '#f59e0b', fontSize: 10, fontWeight: 900 }} stroke="#f59e0b" strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full space-y-4 border-2 border-dashed rounded-3xl bg-slate-50/50">
                  <Clock className="w-12 h-12 text-slate-200" />
                  <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Insufficient Rating Data to Plot Transition</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 border-2 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b py-6 px-8">
            <CardTitle className="text-xl font-black text-slate-900">Sovereign Registry Portfolio</CardTitle>
            <CardDescription className="text-slate-500 font-medium">Direct view of active entities synchronized from live Firestore repository.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="financial-table">
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="px-8 font-black uppercase text-xs text-slate-500">Sovereign Entity</TableHead>
                  <TableHead className="font-black uppercase text-xs text-slate-500">Region</TableHead>
                  <TableHead className="text-right px-8 font-black uppercase text-xs text-slate-500">Market Class</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(countries || []).map((country) => (
                  <TableRow key={country.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="px-8 py-5 font-bold text-slate-900">{country.name}</TableCell>
                    <TableCell className="py-5 text-slate-600 font-medium">{country.region}</TableCell>
                    <TableCell className="text-right px-8 py-5">
                      <Badge variant="outline" className="font-black border-2 px-3">{country.incomeGroup}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(!countries || countries.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                      No countries found. Add some in the Firebase Console under 'countries' collection.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-2 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b py-6 px-8">
            <CardTitle className="text-xl font-black text-slate-900">Recent Analytical Feed</CardTitle>
            <CardDescription className="text-slate-500 font-medium">Latest updates from the analytical and committee team.</CardDescription>
          </CardHeader>
          <CardContent className="pt-8 px-8 pb-8">
            <div className="space-y-4">
              {recentRatings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3 opacity-30">
                    <Clock className="w-10 h-10" />
                    <p className="text-xs font-black uppercase tracking-widest">No Recent Activity</p>
                  </div>
              ) : recentRatings.map((r, i) => (
                <div key={r.id || i} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-all border-2 border-transparent hover:border-slate-100 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate group-hover:text-primary transition-colors">{r.countryName}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                      {r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleDateString() : 'Real-time update'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge className={cn(
                      "font-black text-sm px-3 py-1 shadow-sm",
                      r.approvalStatus === 'approved' ? "bg-green-600 hover:bg-green-700" : "bg-primary"
                    )}>
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
