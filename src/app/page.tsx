
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Globe, ShieldCheck, Clock, TrendingUp, Loader2, Filter, ChevronDown, Plus, BarChart3, Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase"
import { collection, query, orderBy, limit } from "firebase/firestore"
import { Country, Rating } from "@/lib/store"
import Link from "next/link"
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Cell
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
  const [transitionData, setTransitionData] = useState<any[]>([])
  const [riskSnapshotData, setRiskSnapshotData] = useState<any[]>([])
  const [isMounted, setIsMounted] = useState(false)

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

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Default selection to first few countries if none selected
  useEffect(() => {
    if (countries && selectedCountryIds.length === 0 && countries.length > 0) {
      setSelectedCountryIds([countries[0].id])
    }
  }, [countries, selectedCountryIds.length])

  // Compute transition and snapshot data on client side
  useEffect(() => {
    if (!allRatings || !countries) return;

    // 1. Transition Chart Data
    if (selectedCountryIds.length > 0) {
      const dates = Array.from(new Set(allRatings.map(r => {
        const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date();
        return d.toLocaleDateString();
      }))).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

      const computedTransition = dates.map(dateStr => {
        const entry: any = { date: dateStr };
        selectedCountryIds.forEach(cid => {
          const country = countries.find(c => c.id === cid);
          if (!country) return;

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
      setTransitionData(computedTransition);
    } else {
      setTransitionData([]);
    }

    // 2. Risk Snapshot Data (Latest score per country)
    const snapshot = countries.map(c => {
      const countryRatings = allRatings
        .filter(r => r.countryId === c.id)
        .sort((a, b) => {
          const dA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
          const dB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
          return dB.getTime() - dA.getTime();
        });
      
      return {
        name: c.name,
        score: countryRatings[0]?.finalScore || 0
      };
    }).filter(d => d.score > 0);
    setRiskSnapshotData(snapshot);

  }, [allRatings, countries, selectedCountryIds]);

  const stats = {
    totalCountries: countries?.length || 0,
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
        <Button asChild className="bg-primary hover:bg-primary/90 font-bold shadow-md h-12 px-8 rounded-2xl">
          <Link href="/countries#search">
            <Plus className="w-5 h-5 mr-2" /> Start New Rating
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="metric-card border-l-4 border-l-primary hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[11px] font-black uppercase text-slate-700 tracking-wider">Total Countries</CardTitle>
            <Globe className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-slate-900">{stats.totalCountries}</div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Managed in live registry</p>
          </CardContent>
        </Card>
        <Card className="metric-card border-l-4 border-l-accent hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[11px] font-black uppercase text-slate-700 tracking-wider">Ratings Sessions</CardTitle>
            <BarChart3 className="w-4 h-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-slate-900">{stats.ratings}</div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Conducted to date</p>
          </CardContent>
        </Card>
        <Card className="metric-card border-l-4 border-l-yellow-500 hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[11px] font-black uppercase text-slate-700 tracking-wider">Committee Queue</CardTitle>
            <ShieldCheck className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-slate-900">{stats.pending}</div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Awaiting sign-off</p>
          </CardContent>
        </Card>
        <Card className="metric-card border-l-4 border-l-green-500 hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[11px] font-black uppercase text-slate-700 tracking-wider">Avg. Confidence</CardTitle>
            <Target className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-slate-900">{stats.averageScore.toFixed(1)}%</div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Portfolio aggregate</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        {/* New Visual: Country Risk Snapshot */}
        <Card className="lg:col-span-7 border-2 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b py-4 px-8">
            <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-widest">Country Risk Snapshot</CardTitle>
            <CardDescription className="text-slate-500 font-medium">Latest quantitative score comparison across the portfolio.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[200px] w-full">
              {riskSnapshotData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskSnapshotData} layout="vertical" margin={{ left: 40, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#1e293b', fontSize: 10, fontWeight: 900 }}
                      width={100}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '10px', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20}>
                      {riskSnapshotData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.score > 80 ? '#10b981' : entry.score > 50 ? 'hsl(var(--primary))' : '#f59e0b'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full space-y-2 opacity-40">
                  <BarChart3 className="w-8 h-8" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No ratings available yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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
                  Compare ({selectedCountryIds.length})
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
                      No countries found. Add some in the Sovereign Registry.
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
              {!isMounted || recentRatings.length === 0 ? (
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
