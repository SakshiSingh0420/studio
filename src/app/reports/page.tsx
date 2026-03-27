
"use client"

import { useState, useEffect } from "react"
import { getReports, RatingReport } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, FileText, ExternalLink, Calendar, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default function ReportsArchivePage() {
  const [reports, setReports] = useState<RatingReport[]>([])
  const [search, setSearch] = useState("")
  const [yearFilter, setYearFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await getReports()
        setReports(data.sort((a, b) => {
          const dateA = a.generatedAt?.toDate?.() || new Date(0);
          const dateB = b.generatedAt?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        }))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = reports.filter(r => {
    const matchesSearch = r.countryName.toLowerCase().includes(search.toLowerCase()) ||
                         r.rating.toLowerCase().includes(search.toLowerCase());
    const matchesYear = yearFilter === "all" || r.year.toString() === yearFilter;
    return matchesSearch && matchesYear;
  })

  const years = Array.from(new Set(reports.map(r => r.year.toString()))).sort().reverse();

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900">Sovereign Report Archive</h1>
          <p className="text-muted-foreground mt-1 text-lg">Centralized repository of structured rating reports and analytical disclosures.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            className="pl-10 h-11 border-2" 
            placeholder="Search reports by country or rating..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
            <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <select 
                    className="pl-10 h-11 border-2 rounded-md bg-background px-4 text-sm font-bold appearance-none outline-none focus:border-primary"
                    value={yearFilter}
                    onChange={e => setYearFilter(e.target.value)}
                >
                    <option value="all">All Cycles</option>
                    {years.map(y => <option key={y} value={y}>{y} Cycle</option>)}
                </select>
            </div>
        </div>
      </div>

      <Card className="border-2 shadow-sm">
        <CardContent className="p-0">
          <Table className="financial-table">
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="px-8 font-black uppercase text-[10px] text-slate-500 tracking-widest">Report Date</TableHead>
                <TableHead className="font-black uppercase text-[10px] text-slate-500 tracking-widest">Sovereign</TableHead>
                <TableHead className="font-black uppercase text-[10px] text-slate-500 tracking-widest text-center">Cycle</TableHead>
                <TableHead className="font-black uppercase text-[10px] text-slate-500 tracking-widest text-center">Score</TableHead>
                <TableHead className="font-black uppercase text-[10px] text-slate-500 tracking-widest text-center">Rating</TableHead>
                <TableHead className="font-black uppercase text-[10px] text-slate-500 tracking-widest text-center">Status</TableHead>
                <TableHead className="text-right px-8 font-black uppercase text-[10px] text-slate-500 tracking-widest">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                  <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          <div className="flex flex-col items-center justify-center gap-2">
                              <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                              <span className="text-xs font-black uppercase tracking-widest">Retrieving Archive...</span>
                          </div>
                      </TableCell>
                  </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4 opacity-40">
                      <FileText className="w-12 h-12" />
                      <p className="font-black text-lg uppercase tracking-tight">No Reports Found</p>
                      <p className="text-sm max-w-xs mx-auto font-medium">Generate a report from the Rating Execution review screen to populate this archive.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.map((report) => (
                <TableRow key={report.id} className="hover:bg-slate-50/50 transition-colors group">
                  <TableCell className="px-8 py-5 font-medium text-slate-500 text-xs">
                    {report.generatedAt?.toDate ? report.generatedAt.toDate().toLocaleDateString() : 'Draft'}
                  </TableCell>
                  <TableCell className="py-5">
                    <div className="flex flex-col">
                        <span className="font-black text-slate-900 group-hover:text-primary transition-colors">{report.countryName}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{report.region}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center py-5 font-black text-slate-700">{report.year}</TableCell>
                  <TableCell className="text-center py-5 font-black text-slate-900">{report.finalScore.toFixed(1)}%</TableCell>
                  <TableCell className="text-center py-5">
                    <Badge className="font-black text-xs px-3 py-1 bg-slate-900">
                        {report.rating}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center py-5">
                    <Badge variant="outline" className={cn(
                        "font-black text-[9px] uppercase border-2",
                        report.status === 'Approved' ? "border-green-500 text-green-600 bg-green-50" : "border-amber-500 text-amber-600 bg-amber-50"
                    )}>
                        {report.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right px-8 py-5">
                    <Button asChild variant="ghost" size="sm" className="font-bold hover:bg-primary/10 hover:text-primary">
                      <Link href={`/reports/${report.id}`}>
                        <ExternalLink className="w-4 h-4 mr-2" /> View Report
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
