import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { DateRange } from 'react-day-picker'
import { format, endOfDay } from 'date-fns'
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

interface HourlyPrintRate {
  hour: number
  print_count: number
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
  hourly_data: HourlyPrintRate[]
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

export function useAnalyticsData(dateRange: DateRange | undefined, userId?: string | null) {
  // Convert DateRange to date strings
  const startDate = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : null
  const endDate = dateRange?.to ? format(endOfDay(dateRange.to), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : null

  // Try optimized combined query first, fallback to individual queries if function doesn't exist
  const { data: combinedData, isLoading, error } = useQuery({
    queryKey: ['analytics-combined', startDate, endDate, userId],
    queryFn: async () => {
      if (!startDate || !endDate) return null

      const rpcParams: any = {
        start_date: startDate,
        end_date: endDate,
      }
      if (userId) rpcParams.p_user_id = userId

      // Try the optimized function first
      const { data, error } = await supabase.rpc('get_all_analytics' as any, rpcParams)

      // If optimized function doesn't exist (PGRST202), fall back to individual queries
      if (error && error.code === 'PGRST202') {
        console.log('Optimized function not available, using fallback queries')
        
        // Fallback: Run the 5 separate queries
        const [kpisResult, dailyResult, printerResult, statusResult, hourlyResult] = await Promise.all([
          supabase.rpc('get_analytics_kpis', { start_date: startDate, end_date: endDate }),
          supabase.rpc('get_daily_analytics', { start_date: startDate, end_date: endDate }),
          supabase.rpc('get_printer_performance', { start_date: startDate, end_date: endDate }),
          supabase.rpc('get_print_status_breakdown', { start_date: startDate, end_date: endDate }),
          supabase.rpc('get_hourly_print_rate', { start_date: startDate, end_date: endDate }),
        ])

        if (kpisResult.error) throw kpisResult.error
        if (dailyResult.error) throw dailyResult.error
        if (printerResult.error) throw printerResult.error
        if (statusResult.error) throw statusResult.error
        if (hourlyResult.error) throw hourlyResult.error

        // Transform fallback data to match CombinedAnalyticsResponse format
        const kpisData = kpisResult.data?.[0] as any || {}
        const statusData = (statusResult.data || []).reduce((acc: any, item: any) => {
          acc[item.status] = item.count
          return acc
        }, {})

        return {
          kpis: {
            total_orders: kpisData.total_orders || 0,
            printed_orders: kpisData.printed_orders || 0,
            unprinted_orders: (kpisData.total_orders || 0) - (kpisData.printed_orders || 0),
            bundle_orders: kpisData.bundle_orders || 0,
            cancelled_orders: kpisData.cancelled_orders || 0,
            total_print_jobs: kpisData.total_print_jobs || 0,
            successful_prints: kpisData.successful_prints || 0,
            print_success_rate: kpisData.total_print_jobs > 0 
              ? ((kpisData.successful_prints || 0) / kpisData.total_print_jobs) * 100 
              : 0,
          },
          daily_data: dailyResult.data || [],
          printer_performance: printerResult.data || [],
          print_status: {
            done: statusData.done || 0,
            queued: statusData.queued || 0,
            error: statusData.error || 0,
          },
          hourly_data: hourlyResult.data || [],
        } as CombinedAnalyticsResponse
      }

      if (error) {
        console.error('Analytics query error:', error)
        throw error
      }

      return data as unknown as CombinedAnalyticsResponse | null
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
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

  const hourlyData = useMemo(() => {
    return combinedData?.hourly_data || []
  }, [combinedData])

  return {
    isLoading,
    error,
    kpis,
    dailyData,
    printerData,
    printStatusData,
    hourlyData,
  }
}
