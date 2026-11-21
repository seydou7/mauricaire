import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useTranslation } from "react-i18next";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Heart,
  Droplet,
  Activity,
  Scale,
  Wind,
  Thermometer,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Info,
} from "lucide-react";

export function normalizeMetricCode(code: string): string {
  if (!code) return "general";
  const c = code.toLowerCase().trim();
  switch (c) {
    case "bp":
    case "blood_pressure":
    case "tension":
      return "blood_pressure";
    case "pulse":
    case "heart_rate":
    case "pouls":
      return "heart_rate";
    case "glucose":
    case "blood_glucose":
    case "glycemie":
      return "blood_glucose";
    case "temp":
    case "temperature":
      return "temperature";
    case "weight":
    case "poids":
      return "weight";
    case "spo2":
    case "oxygen":
      return "spo2";
    case "hba1c":
      return "hba1c";
    default:
      return c;
  }
}

export function isMatchingMetric(codeA: string, codeB: string): boolean {
  return normalizeMetricCode(codeA) === normalizeMetricCode(codeB);
}

interface HealthObservation {
  _id: string;
  measurementCode: string;
  numericValue?: number;
  secondaryNumericValue?: number;
  textValue?: string;
  unit?: string;
  observedAt: number;
  context?: string;
  clinicalNotes?: string;
  source: string;
  status: string;
  attentionFlag?: {
    severity: string;
    message: string;
  };
}

interface HealthChartsViewProps {
  observations: HealthObservation[];
  selectedMetric?: string;
  onSelectMetric?: (metric: string) => void;
  timeRange: "7d" | "30d" | "3m" | "6m" | "all";
  onTimeRangeChange: (range: "7d" | "30d" | "3m" | "6m" | "all") => void;
}

export const HealthChartsView: React.FC<HealthChartsViewProps> = ({
  observations = [],
  selectedMetric: controlledMetric,
  onSelectMetric,
  timeRange,
  onTimeRangeChange,
}) => {
  const { t } = useTranslation();
  const [internalMetric, setInternalMetric] = useState<string>("blood_pressure");
  const [referenceTime] = useState(() => Date.now());

  const activeMetric = controlledMetric || internalMetric;
  const setMetric = onSelectMetric || setInternalMetric;

  // Filter observations for the active metric, valid status, and optional timeRange
  const metricObservations = useMemo(() => {
    let minTime = 0;
    if (timeRange === "7d") minTime = referenceTime - 7 * 24 * 60 * 60 * 1000;
    else if (timeRange === "30d") minTime = referenceTime - 30 * 24 * 60 * 60 * 1000;
    else if (timeRange === "3m") minTime = referenceTime - 90 * 24 * 60 * 60 * 1000;
    else if (timeRange === "6m") minTime = referenceTime - 180 * 24 * 60 * 60 * 1000;

    return (observations || [])
      .filter((obs) => {
        if (obs.status === "superseded") return false;
        if (!isMatchingMetric(obs.measurementCode, activeMetric)) return false;
        if (minTime > 0 && obs.observedAt < minTime) return false;
        return true;
      })
      .sort((a, b) => a.observedAt - b.observedAt);
  }, [observations, activeMetric, timeRange, referenceTime]);

  // Format data for Recharts
  const chartData = useMemo(() => {
    return metricObservations.map((obs) => {
      const date = new Date(obs.observedAt);
      const formattedDate =
        timeRange === "7d"
          ? date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
          : date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

      const fullDate = date.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      return {
        id: obs._id,
        timestamp: obs.observedAt,
        dateLabel: formattedDate,
        fullDate,
        value: obs.numericValue,
        secondaryValue: obs.secondaryNumericValue,
        unit: obs.unit || "",
        context: obs.context,
        source: obs.source,
        notes: obs.clinicalNotes,
        hasFlag: !!obs.attentionFlag,
      };
    });
  }, [metricObservations, timeRange]);

  // Compute statistics
  const stats = useMemo(() => {
    if (metricObservations.length === 0) return null;

    const values = metricObservations
      .map((o) => o.numericValue)
      .filter((v): v is number => typeof v === "number" && !isNaN(v));

    if (values.length === 0) return null;

    const latest = metricObservations[metricObservations.length - 1];
    const sum = values.reduce((acc, curr) => acc + curr, 0);
    const avg = Math.round((sum / values.length) * 10) / 10;
    const min = Math.min(...values);
    const max = Math.max(...values);

    let trend: "up" | "down" | "stable" = "stable";
    if (values.length >= 2) {
      const first = values[0];
      const last = values[values.length - 1];
      const diff = last - first;
      if (Math.abs(diff) < 0.05 * first) {
        trend = "stable";
      } else if (diff > 0) {
        trend = "up";
      } else {
        trend = "down";
      }
    }

    return {
      count: values.length,
      latestValue: latest.numericValue,
      latestSecondary: latest.secondaryNumericValue,
      latestDate: new Date(latest.observedAt).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      avg,
      min,
      max,
      trend,
      unit: latest.unit || "",
    };
  }, [metricObservations]);

  // Metric metadata
  const metricConfigs: Record<
    string,
    { label: string; icon: React.ReactNode; color: string; unit: string }
  > = {
    blood_pressure: {
      label: t("chronic.metric_blood_pressure", "Tension artérielle"),
      icon: <Heart className="h-4 w-4 text-red-500" />,
      color: "#ef4444",
      unit: "mmHg",
    },
    blood_glucose: {
      label: t("chronic.metric_blood_glucose", "Glycémie"),
      icon: <Droplet className="h-4 w-4 text-blue-500" />,
      color: "#3b82f6",
      unit: "mg/dL",
    },
    heart_rate: {
      label: t("chronic.metric_heart_rate", "Fréquence cardiaque"),
      icon: <Activity className="h-4 w-4 text-rose-500" />,
      color: "#f43f5e",
      unit: "bpm",
    },
    weight: {
      label: t("chronic.metric_weight", "Poids"),
      icon: <Scale className="h-4 w-4 text-amber-500" />,
      color: "#f59e0b",
      unit: "kg",
    },
    spo2: {
      label: t("chronic.metric_spo2", "SpO2"),
      icon: <Wind className="h-4 w-4 text-cyan-500" />,
      color: "#06b6d4",
      unit: "%",
    },
    temperature: {
      label: t("chronic.metric_temperature", "Température"),
      icon: <Thermometer className="h-4 w-4 text-orange-500" />,
      color: "#f97316",
      unit: "°C",
    },
  };

  const activeNorm = normalizeMetricCode(activeMetric);
  const currentConfig = metricConfigs[activeNorm] || metricConfigs.blood_pressure;

  const formatContext = (ctx?: string) => {
    switch (ctx) {
      case "fasting":
        return "À jeun";
      case "after_meal":
        return "Après repas";
      case "resting":
        return "Au repos";
      case "after_exercise":
        return "Après effort";
      default:
        return ctx || "Non précisé";
    }
  };

  const formatSource = (src: string) => {
    switch (src) {
      case "patient_manual":
        return "Patient";
      case "professional_manual":
        return "Praticien";
      case "consultation":
        return "Consultation";
      case "homelab":
        return "HomeLab";
      case "connected_device":
        return "Dispositif connecté";
      default:
        return src;
    }
  };

  return (
    <div className="space-y-6">
      {/* Metric Selector Pills */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
        {Object.entries(metricConfigs).map(([code, cfg]) => {
          const isActive = isMatchingMetric(activeMetric, code);
          return (
            <button
              key={code}
              onClick={() => setMetric(code)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? "bg-teal-600 text-white shadow-sm shadow-teal-600/20"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              {cfg.icon}
              <span>{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* Time Range Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            {currentConfig.icon}
            {currentConfig.label}
          </h3>
          <p className="text-xs text-gray-500">
            Évolution temporelle et dispersion des constantes
          </p>
        </div>

        <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs">
          {(["7d", "30d", "3m", "6m", "all"] as const).map((range) => (
            <button
              key={range}
              onClick={() => onTimeRangeChange(range)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                timeRange === range
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {range === "7d" && "7j"}
              {range === "30d" && "30j"}
              {range === "3m" && "3 mois"}
              {range === "6m" && "6 mois"}
              {range === "all" && "Tout"}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-white rounded-xl border border-gray-200 shadow-sm">
            <span className="text-[11px] font-medium text-gray-500 block">Dernière mesure</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-gray-900">
                {isMatchingMetric(activeMetric, "blood_pressure")
                  ? `${stats.latestValue}/${stats.latestSecondary ?? 80}`
                  : stats.latestValue}
              </span>
              <span className="text-xs text-gray-500">{stats.unit}</span>
            </div>
            <span className="text-[10px] text-gray-400 mt-0.5 block">{stats.latestDate}</span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-gray-200 shadow-sm">
            <span className="text-[11px] font-medium text-gray-500 block">Moyenne ({timeRange})</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-gray-900">{stats.avg}</span>
              <span className="text-xs text-gray-500">{stats.unit}</span>
            </div>
            <span className="text-[10px] text-gray-400 mt-0.5 block">
              {stats.count} point{stats.count > 1 ? "s" : ""}
            </span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-gray-200 shadow-sm">
            <span className="text-[11px] font-medium text-gray-500 block">Min / Max</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-sm font-bold text-gray-700">
                {stats.min} — {stats.max}
              </span>
              <span className="text-xs text-gray-500">{stats.unit}</span>
            </div>
            <span className="text-[10px] text-gray-400 mt-0.5 block">Amplitude</span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-gray-200 shadow-sm">
            <span className="text-[11px] font-medium text-gray-500 block">Tendance</span>
            <div className="mt-1 flex items-center gap-1.5">
              {stats.trend === "up" && (
                <>
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-600">En hausse</span>
                </>
              )}
              {stats.trend === "down" && (
                <>
                  <TrendingDown className="h-4 w-4 text-teal-600" />
                  <span className="text-sm font-semibold text-teal-600">En baisse</span>
                </>
              )}
              {stats.trend === "stable" && (
                <>
                  <Minus className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-semibold text-blue-600">Stable</span>
                </>
              )}
            </div>
            <span className="text-[10px] text-gray-400 mt-0.5 block">Sur la sélection</span>
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        {chartData.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            <Activity className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="font-medium text-gray-600">Aucune mesure enregistrée pour le moment.</p>
            <p className="text-xs text-gray-400 mt-1">
              Les mesures de {currentConfig.label.toLowerCase()} s'afficheront ici dès qu'elles seront enregistrées.
            </p>
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  unit={` ${currentConfig.unit}`}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const isBp = isMatchingMetric(activeMetric, "blood_pressure");
                      return (
                        <div className="bg-white p-3 rounded-xl shadow-lg border border-gray-100 text-xs space-y-1.5 min-w-[200px]">
                          <div className="font-semibold text-gray-800">{data.fullDate}</div>
                          <div className="border-t border-gray-100 pt-1.5 flex items-center justify-between">
                            <span className="text-gray-500">
                              {isBp ? "Systolique (SYS)" : currentConfig.label}
                            </span>
                            <span className="font-bold text-gray-900">
                              {data.value} {data.unit}
                            </span>
                          </div>
                          {isBp && data.secondaryValue !== undefined && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">Diastolique (DIA)</span>
                              <span className="font-bold text-gray-900">
                                {data.secondaryValue} {data.unit}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-gray-100">
                            <span>Source: {formatSource(data.source)}</span>
                            {data.context && <span>{formatContext(data.context)}</span>}
                          </div>
                          {data.notes && (
                            <div className="text-[11px] text-gray-500 italic border-t border-gray-100 pt-1">
                              « {data.notes} »
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ fontSize: "12px", paddingBottom: "10px" }}
                />

                {isMatchingMetric(activeMetric, "blood_pressure") ? (
                  <>
                    <Line
                      type="monotone"
                      name="Systolique (SYS)"
                      dataKey="value"
                      stroke="#ef4444"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#ef4444" }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      name="Diastolique (DIA)"
                      dataKey="secondaryValue"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#3b82f6" }}
                      activeDot={{ r: 5 }}
                    />
                  </>
                ) : (
                  <>
                    <Line
                      type="monotone"
                      name={currentConfig.label}
                      dataKey="value"
                      stroke={currentConfig.color}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: currentConfig.color }}
                      activeDot={{ r: 5 }}
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Calm explanatory footer */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500">
          <Info className="h-4 w-4 text-teal-600 shrink-0" />
          <span>
            {t(
              "chronic.disclaimer_no_diagnosis",
              "Ces données sont collectées à des fins de suivi longitudinal. Elles ne constituent ni un diagnostic médical automatisé ni une prescription thérapeutique."
            )}
          </span>
        </div>
      </div>
    </div>
  );
};
