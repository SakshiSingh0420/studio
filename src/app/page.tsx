
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Globe, ShieldCheck, Clock, TrendingUp, Loader2, Filter, ChevronDown, Plus, BarChart3, Target, Activity } from "lucide-react"
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
  ReferenceArea,
  AreaChart,
  Area
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

const DEMO_COUNTRIES: Partial<Country>[] = [
  { id: 'demo-in', name: "India", region: "Asia", incomeGroup: "Emerging", currency: "INR", gdpSnapshot: 3400, year: 2025 },
  { id: 'demo-us', name: "United States", region: "North America", incomeGroup: "Advanced", currency: "USD", gdpSnapshot: 26000, year: 2026 },
  { id: 'demo-cn', name: "China", region: "Asia", incomeGroup: "Emerging", currency: "CNY", gdpSnapshot: 18000, year: 2026 },
  { id: 'demo-de', name: "Germany", region: "Europe", incomeGroup: "Advanced", currency: "EUR", gdpSnapshot: 4500, year: 2026 },
  { id: 'demo-br', name: "Brazil", region: "South America", incomeGroup: "Emerging", currency: "BRL", gdpSnapshot: 2100, year: 2026 },
  { id: 'demo-za', name: "South Africa", region: "Africa", incomeGroup: "Emerging", currency: "ZAR", gdpSnapshot: 400, year: 2026 },
];

export default function DashboardPage() {
  const db = useFirestore();
  const [selectedCountryIds, setSelectedCountryIds] = useState<string[]>([])
  const [transitionData, setTransitionData] = useState<any[]>([])
  const [isMounted, setIsMounted] = useState(false)

  // Real-time countries collection (UNFILTERED)
  const countriesQuery = useMemoFirebase(() => collection(db, 'countries'), [db]);
  const { data: dbCountries, isLoading: loadingCountries } = useCollection<Country>(countriesQuery);

  // Merge DB countries with Demo countries to match Registry Page
  const countries = useMemo(() => {
    const merged = [
      ...(dbCountries || []),
      ...DEMO_COUNTRIES.filter(d => !(dbCountries || []).some(c => c.name.toLowerCase() === d.name?.toLowerCase()))
    ].map(c => c.name === "India" ? { ...c, currency: "INR" } as Country : c as Country);
    
    return merged;
  }, [dbCountries]);

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
    if (countries.length > 0 && selectedCountryIds.length === 0) {
      setSelectedCountryIds([countries[0].id])
    }
  }, [countries, selectedCountryIds.length])

  // Compute transition data on client side
  useEffect(() => {
    if (!allRatings || !countries.length) return;

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
  }, [allRatings, countries, selectedCountryIds]);

  const stats = {
    totalCountries: countries.length,
    ratings: allRatings?.length || 0,
    pending: allRatings?.filter(r => r.approvalStatus === 'pending').length || 0,
    averageScore: allRatings && allRatings.length > 0 
      ? (allRatings.reduce((acc, r) => acc + (r.finalScore || 0), 0) / allRatings.length) 
      : 0
  }

  const recentRatings = (recentRatingsData || []).map(r => ({
    ...r,
    countryName: countries.find(c => c.id === r.countryId)?.name || 'Unknown Sovereign'
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border-2 border-slate-100 shadow-2xl rounded-2xl p-4 min-w-[200px]">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 border-b pb-2">{label}</p>
          <div className="space-y-3">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs font-bold text-slate-700">{entry.name}</span>
                </div>
                <span className="text-sm font-black text-slate-900">{entry.value.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900">Sovereign Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-lg">Real-time overview of global credit ratings and risk profiles.</p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 font-bold shadow-md h-12 px-8 rounded-2xl" suppressHydrationWarning>
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
        <Card className="lg:col-span-7 border-2 shadow-sm overflow-hidden">
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between bg-white border-b py-8 px-10 gap-4">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <Activity className="w-6 h-6 text-primary" />
                Sovereign Rating Transitions
              </CardTitle>
              <CardDescription className="text-slate-500 font-medium text-base">Comparative historical trend analysis of quantitative risk scores.</CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-2 font-bold h-11 px-6 rounded-xl hover:bg-slate-50 transition-all" suppressHydrationWarning>
                  <Filter className="w-4 h-4 mr-2" /> 
                  Compare Entities ({selectedCountryIds.length})
                  <ChevronDown className="ml-2 w-4 h-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2 rounded-xl">
                <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 px-2">Sovereign Portfolio</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {countries.map(c => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={selectedCountryIds.includes(c.id)}
                    onCheckedChange={() => toggleCountry(c.id)}
                    className="font-bold py-2 px-3 rounded-lg cursor-pointer"
                  >
                    {c.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent className="p-10">
            <div className="h-[450px] w-full">
              {transitionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={transitionData} margin={{ top: 20, right: 40, left: 10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="primeZone" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.05}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                      dy={15}
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                      dx={-10}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    
                    <ReferenceArea y1={80} y2={100} fill="#10b981" fillOpacity={0.03} />
                    <ReferenceArea y1={50} y2={80} fill="#f59e0b" fillOpacity={0.02} />
                    <ReferenceArea y1={0} y2={50} fill="#ef4444" fillOpacity={0.01} />

                    <ReferenceLine y={80} label={{ value: 'PRIME', position: 'insideRight', fill: '#10b981', fontSize: 10, fontWeight: 900, dy: -10 }} stroke="#10b981" strokeDasharray="5 5" strokeOpacity={0.5} />
                    <ReferenceLine y={50} label={{ value: 'INVESTMENT GRADE', position: 'insideRight', fill: '#f59e0b', fontSize: 10, fontWeight: 900, dy: -10 }} stroke="#f59e0b" strokeDasharray="5 5" strokeOpacity={0.5} />

                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      height={50} 
                      iconType="circle"
                      wrapperStyle={{ fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: '20px' }}
                    />
                    
                    {selectedCountryIds.map((cid, index) => {
                      const name = countries.find(c => c.id === cid)?.name;
                      if (!name) return null;
                      return (
                        <Line
                          key={cid}
                          type="monotone"
                          dataKey={name}
                          stroke={chartColors[index % chartColors.length]}
                          strokeWidth={4}
                          dot={{ r: 5, strokeWidth: 3, fill: 'white' }}
                          activeDot={{ r: 8, strokeWidth: 0, fill: chartColors[index % chartColors.length] }}
                          animationDuration={2000}
                          connectNulls
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full space-y-6 border-4 border-dashed rounded-[3rem] bg-slate-50/50">
                  <div className="p-6 bg-white rounded-full shadow-lg">
                    <Activity className="w-12 h-12 text-slate-200" />
                  </div>
                  <div className="text-center">
                    <p className="text-slate-400 font-black uppercase text-sm tracking-widest mb-1">Insufficient Analytical Data</p>
                    <p className="text-slate-400/60 font-medium text-xs">Execute more rating sessions to visualize portfolio transitions.</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 border-2 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b py-8 px-10">
            <CardTitle className="text-xl font-black text-slate-900">Portfolio Registry</CardTitle>
            <CardDescription className="text-slate-500 font-medium">Real-time view of active sovereign entities.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="financial-table">
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="px-10 font-black uppercase text-[10px] text-slate-500 tracking-widest">Sovereign</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-slate-500 tracking-widest">Region</TableHead>
                  <TableHead className="text-right px-10 font-black uppercase text-[10px] text-slate-500 tracking-widest">Classification</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {countries.slice(0, 8).map((country) => (
                  <TableRow key={country.id} className="hover:bg-slate-50/50 transition-colors border-b last:border-0">
                    <TableCell className="px-10 py-6 font-bold text-slate-900">{country.name}</TableCell>
                    <TableCell className="py-6 text-slate-600 font-medium">{country.region}</TableCell>
                    <TableCell className="text-right px-10 py-6">
                      <Badge variant="outline" className="font-black border-2 px-3 bg-white">{country.incomeGroup}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {countries.length === 0 && (
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
          <CardHeader className="bg-slate-50/50 border-b py-8 px-10">
            <CardTitle className="text-xl font-black text-slate-900">Recent Analytical Feed</CardTitle>
            <CardDescription className="text-slate-500 font-medium">Latest portfolio risk updates.</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="space-y-4">
              {!isMounted || recentRatings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 space-y-4 opacity-30">
                    <Clock className="w-12 h-12" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No Recent Activity</p>
                  </div>
              ) : recentRatings.map((r, i) => (
                <div key={r.id || i} className="flex items-center gap-5 p-5 rounded-3xl hover:bg-slate-50 transition-all border-2 border-transparent hover:border-slate-100 group bg-white shadow-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-black text-slate-900 truncate group-hover:text-primary transition-colors">{r.countryName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase" suppressHydrationWarning>
                        {r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleDateString() : 'Real-time update'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge className={cn(
                      "font-black text-sm px-4 py-2 shadow-lg rounded-xl border-b-4",
                      r.approvalStatus === 'approved' ? "bg-green-600 hover:bg-green-700 border-green-800" : "bg-primary border-primary-foreground/20"
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
