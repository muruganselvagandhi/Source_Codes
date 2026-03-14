import React, { useState, useEffect } from 'react';
import {
  Battery,
  Zap,
  AlertTriangle,
  Activity,
  TrendingUp,
  Thermometer,
  Droplet,
  Shield,
  Power,
  Clock,
  Download,
  RefreshCw,
  Database,
  Wifi
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  Bar
} from 'recharts';

const BMSDashboard = () => {
  const [vehicleData, setVehicleData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState('scooter01');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [dataRate, setDataRate] = useState(0);
  const [historicalRange, setHistoricalRange] = useState(30);

  const FIREBASE_URL = 'https://batterydata-53844-default-rtdb.firebaseio.com';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const startTime = Date.now();
        const response = await fetch(
          `${FIREBASE_URL}/vehicles/${selectedVehicle}/logs.json`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch data from Firebase');
        }

        const data = await response.json();

        if (!data) {
          setError('No data found for this vehicle');
          setIsConnected(false);
          return;
        }

        const logsArray = Object.entries(data).map(([id, logData]) => ({
          id,
          timestamp: parseInt(id),
          ...logData
        }));

        const sortedLogs = logsArray.sort((a, b) => b.timestamp - a.timestamp);

        setLogs(sortedLogs);
        setVehicleData(sortedLogs[0]);
        setIsConnected(true);
        setError(null);
        setLastUpdate(new Date());

        const fetchDuration = Date.now() - startTime;
        setDataRate(fetchDuration);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message);
        setIsConnected(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [selectedVehicle]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-20 h-20 text-red-400 mx-auto mb-4 animate-pulse" />
          <div className="text-red-400 text-2xl font-bold mb-2">
            Connection Error
          </div>
          <div className="text-slate-300 mb-4">{error}</div>
          <div className="text-sm text-slate-500 bg-slate-800 p-4 rounded-lg border border-slate-700">
            <p className="mb-2">Troubleshooting:</p>
            <ul className="text-left space-y-1">
              <li>• Check Firebase database URL</li>
              <li>• Verify read permissions in Firebase rules</li>
              <li>• Ensure data exists at the path</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (!vehicleData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-20 h-20 text-cyan-400 animate-pulse mx-auto mb-4" />
          <div className="text-cyan-400 text-2xl font-bold mb-2">
            Connecting to BMS...
          </div>
          <div className="text-slate-400 text-sm">
            Establishing real-time data stream
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
            <div
              className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
              style={{ animationDelay: '0.2s' }}
            ></div>
            <div
              className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
              style={{ animationDelay: '0.4s' }}
            ></div>
          </div>
        </div>
      </div>
    );
  }

  const cellVoltages = [
    { cell: 'C1', voltage: vehicleData.c1_v, max: 4.2, min: 3.0 },
    { cell: 'C2', voltage: vehicleData.c2_v, max: 4.2, min: 3.0 },
    { cell: 'C3', voltage: vehicleData.c3_v, max: 4.2, min: 3.0 },
    { cell: 'C4', voltage: vehicleData.c4_v, max: 4.2, min: 3.0 },
    { cell: 'C5', voltage: vehicleData.c5_v, max: 4.2, min: 3.0 },
    { cell: 'C6', voltage: vehicleData.c6_v, max: 4.2, min: 3.0 },
    { cell: 'C7', voltage: vehicleData.c7_v, max: 4.2, min: 3.0 }
  ];

  const avgVoltage = (
    cellVoltages.reduce((sum, c) => sum + c.voltage, 0) / 7
  ).toFixed(3);
  const minVoltage = Math.min(...cellVoltages.map(c => c.voltage)).toFixed(3);
  const maxVoltage = Math.max(...cellVoltages.map(c => c.voltage)).toFixed(3);
  const voltageDelta = (maxVoltage - minVoltage).toFixed(3);

  const avgTemp = ((vehicleData.temp1_c + vehicleData.temp2_c) / 2).toFixed(1);
  const tempDelta = Math.abs(
    vehicleData.temp1_c - vehicleData.temp2_c
  ).toFixed(1);
  const tempStatus =
    avgTemp > 40
      ? 'CRITICAL'
      : avgTemp > 35
      ? 'HIGH'
      : avgTemp > 30
      ? 'WARM'
      : avgTemp > 25
      ? 'NORMAL'
      : 'COOL';
  const tempColor =
    avgTemp > 40
      ? 'text-red-500'
      : avgTemp > 35
      ? 'text-orange-500'
      : avgTemp > 30
      ? 'text-yellow-400'
      : avgTemp > 25
      ? 'text-green-400'
      : 'text-cyan-400';

  const historyData = logs
    .slice(0, historicalRange)
    .reverse()
    .map((log, idx) => {
      const cellArray = [
        log.c1_v,
        log.c2_v,
        log.c3_v,
        log.c4_v,
        log.c5_v,
        log.c6_v,
        log.c7_v
      ];
      const minCell = Math.min(...cellArray);
      const maxCell = Math.max(...cellArray);
      const avgCell =
        cellArray.reduce((sum, v) => sum + v, 0) / cellArray.length;

      return {
        time: idx,
        c1: log.c1_v || 0,
        c2: log.c2_v || 0,
        c3: log.c3_v || 0,
        c4: log.c4_v || 0,
        c5: log.c5_v || 0,
        c6: log.c6_v || 0,
        c7: log.c7_v || 0,
        pack_v: log.pack_v || 0,
        soc: log.soc || 0,
        temp1: log.temp1_c || 0,
        temp2: log.temp2_c || 0,
        rem_ah: log.rem_ah || 0,
        avg: avgCell,
        min: minCell,
        max: maxCell,
        delta: maxCell - minCell
      };
    });

  const protectionStatus =
    vehicleData.prot_flags === 0
      ? 'NO FAULTS'
      : `FAULT: ${vehicleData.prot_flags}`;
  const protectionColor =
    vehicleData.prot_flags === 0 ? 'text-green-400' : 'text-red-400';

  const cellImbalance = parseFloat(voltageDelta) > 0.05;

  const capacityUsedPercent = (
    ((vehicleData.full_ah - vehicleData.rem_ah) / vehicleData.full_ah) *
    100
  ).toFixed(1);
  const estimatedRange = (vehicleData.rem_ah * 20).toFixed(1); // 20km per Ah (rough)
  const powerEstimate = (
    vehicleData.pack_v * (vehicleData.full_ah - vehicleData.rem_ah)
  ).toFixed(1);

  const exportData = () => {
    const csv = [
      [
        'Log ID',
        'Pack Voltage',
        'SOC',
        'C1',
        'C2',
        'C3',
        'C4',
        'C5',
        'C6',
        'C7',
        'Temp1',
        'Temp2',
        'Rem Ah',
        'Full Ah',
        'Charge FET',
        'Discharge FET',
        'Balance FET',
        'Prot Flags'
      ],
      ...logs.map(log => [
        log.id,
        log.pack_v,
        log.soc,
        log.c1_v,
        log.c2_v,
        log.c3_v,
        log.c4_v,
        log.c5_v,
        log.c6_v,
        log.c7_v,
        log.temp1_c,
        log.temp2_c,
        log.rem_ah,
        log.full_ah,
        log.charge_fet,
        log.discharge_fet,
        log.balance_fet,
        log.prot_flags
      ])
    ]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bms_data_${selectedVehicle}_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2">
            Battery Management System
          </h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-400">
              Vehicle:{' '}
              <span className="text-cyan-400 font-semibold">
                {selectedVehicle.toUpperCase()}
              </span>
            </span>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1">
              <Database className="w-3 h-3 text-slate-400" />
              <span className="text-slate-400">Firebase Realtime</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-slate-900 px-4 py-2 rounded-lg border border-slate-800 flex items-center gap-2">
            <Wifi
              className={`w-4 h-4 ${
                isConnected ? 'text-green-400' : 'text-red-400'
              }`}
            />
            <div className="flex flex-col">
              <span className="text-xs text-slate-400">Status</span>
              <span
                className={`text-sm font-semibold ${
                  isConnected ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          <div className="bg-slate-900 px-4 py-2 rounded-lg border border-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <div className="flex flex-col">
              <span className="text-xs text-slate-400">Last Update</span>
              <span className="text-sm font-semibold text-slate-200">
                {lastUpdate ? lastUpdate.toLocaleTimeString() : '--'}
              </span>
            </div>
          </div>

          <div className="bg-slate-900 px-4 py-2 rounded-lg border border-slate-800 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-cyan-400" />
            <div className="flex flex-col">
              <span className="text-xs text-slate-400">Fetch Time</span>
              <span className="text-sm font-semibold text-slate-200">
                {dataRate}ms
              </span>
            </div>
          </div>

          <button
            onClick={exportData}
            className="bg-cyan-500 hover:bg-cyan-600 text-slate-900 px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-6">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-4 hover:border-cyan-500/50 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Pack Voltage
            </span>
            <Zap className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-cyan-400">
            {vehicleData.pack_v}V
          </div>
          <div className="text-xs text-slate-500 mt-1">7S Configuration</div>
          <div className="mt-2 text-xs text-slate-400">
            Avg: {avgVoltage}V/cell
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-4 hover:border-green-500/50 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              State of Charge
            </span>
            <Battery className="w-4 h-4 text-green-400" />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-green-400">
            {vehicleData.soc}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {vehicleData.rem_ah}/{vehicleData.full_ah} Ah
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Est. Range: {estimatedRange}km
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-4 hover:border-blue-500/50 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Capacity
            </span>
            <Droplet className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-blue-400">
            {vehicleData.rem_ah}Ah
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Used: {capacityUsedPercent}%
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Power: {powerEstimate}Wh
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-4 hover:border-orange-500/50 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Temperature
            </span>
            <Thermometer className="w-4 h-4 text-orange-400" />
          </div>
          <div className={`text-2xl md:text-3xl font-bold ${tempColor}`}>
            {avgTemp}°C
          </div>
          <div className="text-xs text-slate-500 mt-1">{tempStatus}</div>
          <div className="mt-2 text-xs text-slate-400">
            Delta: {tempDelta}°C
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-4 hover:border-purple-500/50 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Cell Balance
            </span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-purple-400">
            {voltageDelta}V
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {cellImbalance ? 'Imbalanced' : 'Balanced'}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Range: {minVoltage}-{maxVoltage}V
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-4 hover:border-green-500/50 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Protection
            </span>
            <Shield className="w-4 h-4 text-green-400" />
          </div>
          <div className={`text-xl md:text-2xl font-bold ${protectionColor}`}>
            {vehicleData.prot_flags === 0 ? 'OK' : 'FAULT'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Code: {vehicleData.prot_flags}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Status: {protectionStatus}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Cell Voltage Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Cell Voltage Distribution
          </h3>
          <div className="space-y-3">
            {cellVoltages.map(cell => {
              const percentage =
                ((cell.voltage - cell.min) / (cell.max - cell.min)) * 100;
              const isLow = cell.voltage < 3.5;
              const isHigh = cell.voltage > 4.1;

              return (
                <div key={cell.cell}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400 font-mono font-semibold">
                      {cell.cell}
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        isLow
                          ? 'text-red-400'
                          : isHigh
                          ? 'text-green-400'
                          : 'text-cyan-400'
                      }`}
                    >
                      {cell.voltage.toFixed(3)}V
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isLow
                          ? 'bg-gradient-to-r from-red-600 to-red-400'
                          : isHigh
                          ? 'bg-gradient-to-r from-green-600 to-green-400'
                          : 'bg-gradient-to-r from-cyan-600 to-blue-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Min:</span>
              <div className="text-cyan-400 font-semibold">{minVoltage}V</div>
            </div>
            <div>
              <span className="text-slate-500">Avg:</span>
              <div className="text-cyan-400 font-semibold">{avgVoltage}V</div>
            </div>
            <div>
              <span className="text-slate-500">Max:</span>
              <div className="text-cyan-400 font-semibold">{maxVoltage}V</div>
            </div>
          </div>
        </div>

        {/* FET Control & Thermal */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
            <Power className="w-5 h-5" />
            FET Control & Thermal Status
          </h3>
          <div className="space-y-3">
            <div
              className={`rounded-lg p-4 border-l-4 transition-all ${
                vehicleData.discharge_fet
                  ? 'bg-green-900/30 border-green-400'
                  : 'bg-slate-800 border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300 text-sm font-semibold">
                  DISCHARGE FET
                </span>
                <div
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    vehicleData.discharge_fet
                      ? 'bg-green-500 text-slate-900'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {vehicleData.discharge_fet ? 'ON' : 'OFF'}
                </div>
              </div>
              <div className="text-lg font-bold text-slate-200">
                {vehicleData.discharge_fet ? '⚡ ACTIVE' : '⏸ INACTIVE'}
              </div>
            </div>

            <div
              className={`rounded-lg p-4 border-l-4 transition-all ${
                vehicleData.charge_fet
                  ? 'bg-blue-900/30 border-blue-400'
                  : 'bg-slate-800 border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300 text-sm font-semibold">
                  CHARGE FET
                </span>
                <div
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    vehicleData.charge_fet
                      ? 'bg-blue-500 text-slate-900'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {vehicleData.charge_fet ? 'ON' : 'OFF'}
                </div>
              </div>
              <div className="text-lg font-bold text-slate-200">
                {vehicleData.charge_fet ? '🔋 CHARGING' : '🔌 IDLE'}
              </div>
            </div>

            <div
              className={`rounded-lg p-4 border-l-4 transition-all ${
                vehicleData.balance_fet
                  ? 'bg-purple-900/30 border-purple-400'
                  : 'bg-slate-800 border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300 text-sm font-semibold">
                  BALANCE FET
                </span>
                <div
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    vehicleData.balance_fet
                      ? 'bg-purple-500 text-slate-900'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {vehicleData.balance_fet ? 'ON' : 'OFF'}
                </div>
              </div>
              <div className="text-lg font-bold text-slate-200">
                {vehicleData.balance_fet ? '⚖️ BALANCING' : '✓ BALANCED'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-gradient-to-br from-orange-900/30 to-slate-800 rounded-lg p-3 border border-orange-500/30">
                <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                  <Thermometer className="w-3 h-3" />
                  SENSOR 1
                </div>
                <div className="text-2xl font-bold text-orange-400">
                  {vehicleData.temp1_c}°C
                </div>
              </div>
              <div className="bg-gradient-to-br from-orange-900/30 to-slate-800 rounded-lg p-3 border border-orange-500/30">
                <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                  <Thermometer className="w-3 h-3" />
                  SENSOR 2
                </div>
                <div className="text-2xl font-bold text-orange-400">
                  {vehicleData.temp2_c}°C
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Capacity & Health */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
            <Battery className="w-5 h-5" />
            Capacity & Health Status
          </h3>
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-36 h-60 border-4 border-cyan-400 rounded-xl overflow-hidden shadow-2xl">
              <div
                className="absolute bottom-0 w-full bg-gradient-to-t from-cyan-600 via-cyan-400 to-cyan-300 transition-all duration-1000"
                style={{ height: `${vehicleData.soc}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="text-center bg-slate-900/80 px-4 py-3 rounded-lg backdrop-blur-sm">
                  <div className="text-4xl font-bold text-white drop-shadow-lg">
                    {vehicleData.soc}%
                  </div>
                  <div className="text-sm text-slate-200 drop-shadow-lg font-semibold">
                    SOC
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 w-full">
              <div className="bg-slate-800/70 rounded-lg p-3 text-xs">
                <div className="text-slate-400">Remaining Capacity</div>
                <div className="text-lg font-bold text-cyan-300">
                  {vehicleData.rem_ah} Ah
                </div>
                <div className="text-slate-500">
                  of {vehicleData.full_ah} Ah
                </div>
              </div>
              <div className="bg-slate-800/70 rounded-lg p-3 text-xs">
                <div className="text-slate-400">Estimated Range</div>
                <div className="text-lg font-bold text-green-300">
                  {estimatedRange} km
                </div>
                <div className="text-slate-500">based on 20km/Ah</div>
              </div>
              <div className="bg-slate-800/70 rounded-lg p-3 text-xs">
                <div className="text-slate-400">Energy Used</div>
                <div className="text-lg font-bold text-yellow-300">
                  {powerEstimate} Wh
                </div>
                <div className="text-slate-500">
                  {capacityUsedPercent}% of pack
                </div>
              </div>
              <div className="bg-slate-800/70 rounded-lg p-3 text-xs">
                <div className="text-slate-400">Health Status</div>
                <div className="text-lg font-bold text-emerald-300">
                  {capacityUsedPercent < 70
                    ? 'HEALTHY'
                    : capacityUsedPercent < 85
                    ? 'MODERATE'
                    : 'AGED'}
                </div>
                <div className="text-slate-500">approximation</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Trends & Radar */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Historical Trends */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-cyan-400 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Historical Trends
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-400">
                Points: {Math.min(historicalRange, logs.length)}
              </span>
              <input
                type="range"
                min={5}
                max={Math.max(5, Math.min(100, logs.length || 5))}
                value={Math.min(historicalRange, logs.length || 5)}
                onChange={e =>
                  setHistoricalRange(Number(e.target.value || 5))
                }
                className="w-32 accent-cyan-400"
              />
            </div>
          </div>

          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10 }}
                  label={{
                    value: 'Voltage (V)',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fill: '#94a3b8', fontSize: 10 }
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10 }}
                  label={{
                    value: 'SOC (%)',
                    angle: 90,
                    position: 'insideRight',
                    style: { fill: '#94a3b8', fontSize: 10 }
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#020617',
                    borderColor: '#1e293b',
                    fontSize: 12
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="pack_v"
                  fill="rgba(56,189,248,0.3)"
                  stroke="rgba(56,189,248,1)"
                  name="Pack Voltage"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="soc"
                  stroke="rgba(74,222,128,1)"
                  dot={false}
                  name="SOC"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  label={{
                    value: 'Temp (°C)',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fill: '#94a3b8', fontSize: 10 }
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#020617',
                    borderColor: '#1e293b',
                    fontSize: 12
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="temp1"
                  stroke="rgba(249,115,22,1)"
                  dot={false}
                  name="Temp 1"
                />
                <Line
                  type="monotone"
                  dataKey="temp2"
                  stroke="rgba(234,179,8,1)"
                  dot={false}
                  name="Temp 2"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cell Radar & Latest Log */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
              Cell Radar View
            </h3>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  data={cellVoltages.map(c => ({
                    cell: c.cell,
                    voltage: c.voltage
                  }))}
                >
                  <PolarGrid />
                  <PolarAngleAxis dataKey="cell" />
                  <PolarRadiusAxis />
                  <Radar
                    name="Voltage"
                    dataKey="voltage"
                    stroke="rgba(56,189,248,1)"
                    fill="rgba(56,189,248,0.3)"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#020617',
                      borderColor: '#1e293b',
                      fontSize: 12
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">
              Latest Log Snapshot
            </h3>
            <div className="text-xs text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Timestamp</span>
                <span>
                  {new Date(vehicleData.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Pack Voltage</span>
                <span>{vehicleData.pack_v} V</span>
              </div>
              <div className="flex justify-between">
                <span>SOC</span>
                <span>{vehicleData.soc}%</span>
              </div>
              <div className="flex justify-between">
                <span>Temps</span>
                <span>
                  {vehicleData.temp1_c} / {vehicleData.temp2_c} °C
                </span>
              </div>
              <div className="flex justify-between">
                <span>FETs</span>
                <span>
                  C:
                  {vehicleData.charge_fet ? 'ON' : 'OFF'} | D:
                  {vehicleData.discharge_fet ? 'ON' : 'OFF'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Balance</span>
                <span>{vehicleData.balance_fet ? 'ACTIVE' : 'OFF'}</span>
              </div>
              <div className="flex justify-between">
                <span>Protection</span>
                <span>{protectionStatus}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BMSDashboard;
