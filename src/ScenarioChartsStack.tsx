import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART } from './chartColors'
import type { CropResult } from './calculatorTypes'
import type { CalculatorState } from './calculatorTypes'
import type { CropType, Scenario } from './types'
import {
  buildDnCalendarChartData,
  buildDnProfileChartData,
  buildFarmMonthlyData,
  SCENARIO_LABELS,
} from './scenarioChartData'

const SCENARIOS: Scenario[] = ['min', 'avg', 'max']

type StackKind = 'farm-monthly' | 'dn-calendar' | 'dn-profile'

interface ScenarioChartsStackProps {
  kind: StackKind
  cropType: CropType
  state: CalculatorState
  sdResult: CropResult
}

function FarmMonthlyChart({
  data,
  cropType,
}: {
  data: Array<Record<string, string | number>>
  cropType: CropType
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis width={48} />
        <Tooltip />
        <Legend />
        {(cropType === 'SD' || cropType === 'both') && (
          <Bar dataKey="КСД" fill={CHART.sd} name="КСД, кг с фермы" />
        )}
        {(cropType === 'DN' || cropType === 'both') && (
          <Bar dataKey="НСД" fill={CHART.dn} name="НСД, кг с фермы" />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}

function DnCalendarChart({ data }: { data: ReturnType<typeof buildDnCalendarChartData> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis width={48} />
        <Tooltip />
        <Bar dataKey="marketKg" fill={CHART.sky} name="кг/м²/мес" />
      </BarChart>
    </ResponsiveContainer>
  )
}

function DnProfileChart({
  data,
  manualProfile,
}: {
  data: ReturnType<typeof buildDnProfileChartData>
  manualProfile: boolean
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          label={{
            value: manualProfile ? 'Месяц года' : 'Месяц цикла',
            position: 'insideBottom',
            offset: -4,
          }}
        />
        <YAxis width={48} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="marketKgPerMonth"
          stroke={CHART.berry}
          strokeWidth={2}
          dot={false}
          name="кг/м²/мес"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function ScenarioChartsStack({ kind, cropType, state, sdResult }: ScenarioChartsStackProps) {
  return (
    <div className="pdf-scenario-stack">
      {SCENARIOS.map((scenario) => (
        <div className="pdf-scenario-block" key={scenario}>
          <h4 className="pdf-scenario-title">{SCENARIO_LABELS[scenario]}</h4>
          <div className="chart-wrap">
            {kind === 'farm-monthly' && (
              <FarmMonthlyChart data={buildFarmMonthlyData(state, sdResult, scenario)} cropType={cropType} />
            )}
            {kind === 'dn-calendar' && <DnCalendarChart data={buildDnCalendarChartData(state, scenario)} />}
            {kind === 'dn-profile' && (
              <DnProfileChart
                data={buildDnProfileChartData(state, scenario)}
                manualProfile={state.dnManualProfileEnabled}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
