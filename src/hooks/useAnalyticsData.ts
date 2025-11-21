import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { DateRange } from 'react-day-picker'
import { format } from 'date-fns'
import { useMemo } from 'react'

interface AnalyticsKPIs {
  totalOrders: number
  printedOrders: number
  unprintedOrders: number
  bundleOrders: number
  cancelledOrders: number
  totalPrintJobs: number
  successfulPrints: number
  printedPercentage: string
  printSuccessRate: string
  bundlePercentage: string
  cancelledPercentage: string
}

interface DailyAnalytics {
  date: string
  total_orders: number
  printed_orders: number
  unprinted_orders: number
  bundle_orders: number
  cancelled_orders: number
  print_jobs_count: number
}

interface PrinterPerformance {
  printer_id: string
  job_count: number
}

interface PrintStatus {
  done: number
  queued: number
  error: number
}

interface CombinedAnalyticsResponse {
  kpis: {
    total_orders: number
    printed_orders: number
    unprinted_orders: number
    bundle_orders: number
    cancelled_orders: number
    total_print_jobs: number
    successful_prints: number
    print_success_rate: number
  }
  daily_data: DailyAnalytics[]
  printer_performance: PrinterPerformance[]
  print_status: PrintStatus
}

// Default KPI values for loading state
const defaultKpis: AnalyticsKPIs = {
  totalOrders: 0,
  printedOrders: 0,
  unprintedOrders: 0,
  bundleOrders: 0,
  cancelledOrders: 0,
  totalPrintJobs: 0,
  successfulPrints: 0,
  printedPercentage: '0.0',
  printSuccessRate: '0.0',
  bundlePercentage: '0.0',
  cancelledPercentage: '0.0',
}

export function useAnalyticsData(dateRange: DateRange | undefined) {
  // Convert DateRange to date strings
  const startDate = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : null
  const endDate = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : null

  // Use optimized combined query (60-70% faster than 4 separate queries)
  const { data: combinedData, isLoading, error } = useQuery({
    queryKey: ['analytics-combined', startDate, endDate],
    queryFn: async () => {
      if (!startDate || !endDate) return null

      const { data, error } = await supabase.rpc('get_all_analytics' as any, {
        start_date: startDate,
        end_date: endDate,
      })

      if (error) {
        console.error('Analytics query error:', error)
        throw error
      }

      return data as unknown as CombinedAnalyticsResponse | null
    },
    staleTime: 15 * 60 * 1000, // 15 minutes (increased from 5 minutes)
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    enabled: !!startDate && !!endDate,
  })

  // Parse the combined response into existing data structures
  // This maintains compatibility with existing chart components
  const kpis = useMemo((): AnalyticsKPIs => {
    if (!combinedData?.kpis) return defaultKpis

    const kpiData = combinedData.kpis
    const totalOrders = Number(kpiData.total_orders) || 0
    const printedOrders = Number(kpiData.printed_orders) || 0
    const bundleOrders = Number(kpiData.bundle_orders) || 0
    const cancelledOrders = Number(kpiData.cancelled_orders) || 0
    const totalPrintJobs = Number(kpiData.total_print_jobs) || 0
    const successfulPrints = Number(kpiData.successful_prints) || 0

    return {
      totalOrders,
      printedOrders,
      unprintedOrders: Number(kpiData.unprinted_orders) || 0,
      bundleOrders,
      cancelledOrders,
      totalPrintJobs,
      successfulPrints,
      printedPercentage: totalOrders > 0 
        ? ((printedOrders / totalOrders) * 100).toFixed(1)
        : '0.0',
      printSuccessRate: totalPrintJobs > 0
        ? ((successfulPrints / totalPrintJobs) * 100).toFixed(1)
        : '0.0',
      bundlePercentage: totalOrders > 0
        ? ((bundleOrders / totalOrders) * 100).toFixed(1)
        : '0.0',
      cancelledPercentage: totalOrders > 0
        ? ((cancelledOrders / totalOrders) * 100).toFixed(1)
        : '0.0',
    }
  }, [combinedData])

  const dailyData = useMemo(() => {
    return combinedData?.daily_data || []
  }, [combinedData])

  const printerData = useMemo(() => {
    return combinedData?.printer_performance || []
  }, [combinedData])

  const printStatusData = useMemo(() => {
    if (!combinedData?.print_status) return []
    
    const status = combinedData.print_status
    return [
      { status: 'done', count: Number(status.done) || 0 },
      { status: 'queued', count: Number(status.queued) || 0 },
      { status: 'error', count: Number(status.error) || 0 },
    ]
  }, [combinedData])

  return {
    isLoading,
    error,
    kpis,
    dailyData,
    printerData,
    printStatusData,
  }
}
