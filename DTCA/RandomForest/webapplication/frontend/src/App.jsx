import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ComposedChart, Line } from 'recharts';
import { Wind, Zap, TrendingUp, LogOut, Gauge, Upload, Database, Filter, RotateCcw, AlertCircle, Send, Radio, Navigation } from 'lucide-react';
import mqtt from 'mqtt';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import StatCard from './components/StatCard';
import Dropdown from './components/Dropdown';
import { predictPower, MONTHS, DAYS, parseDate, generateSampleData } from './utils/helpers';
import { removeAuthToken, removeUserData, getUserData, mlAPI } from './utils/api';

const Dashboard = ({ user, onLogout }) => {
  const username = user?.username || user;
  const [rawData, setRawData] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [parseErrors, setParseErrors] = useState(0);
  const [dataInfo, setDataInfo] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedWeek, setSelectedWeek] = useState('all');
  const [selectedDay, setSelectedDay] = useState('all');
  const [viewMode, setViewMode] = useState('monthly');
  const [windInput, setWindInput] = useState(7);
  const [turbineCount, setTurbineCount] = useState(10);
  const [areaSize, setAreaSize] = useState(500);
  const [predictedPower, setPredictedPower] = useState(0);
  const [mlModelInfo, setMlModelInfo] = useState(null);
  const [useManualInput, setUseManualInput] = useState(false); // Toggle for prediction section
  const [useMqttManualInput, setUseMqttManualInput] = useState(false); // Toggle for MQTT section
  
  // HiveMQ Connection
  const [mqttWindSpeed, setMqttWindSpeed] = useState(8);
  const [mqttWindDirection, setMqttWindDirection] = useState(180);
  const [mqttStatus, setMqttStatus] = useState('disconnected'); // disconnected, connecting, connected, sending, sent, error
  const [lastSentData, setLastSentData] = useState(null);
  const [mqttClient, setMqttClient] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  
  const directionLabels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const getDirectionLabel = (deg) => directionLabels[Math.round(deg / 45) % 8];
  
  // HiveMQ Configuration
  const MQTT_CONFIG = {
    broker: 'wss://1bb52e5669a44705a46bedceffaee603.s1.eu.hivemq.cloud:8884/mqtt',
    username: 'WindFarm',
    password: 'Wind1234',
    topic: 'windfarm/web'
  };
  
  // Connect to HiveMQ
  const connectMQTT = () => {
    if (mqttClient && mqttClient.connected) return;
    
    setMqttStatus('connecting');
    setConnectionError(null);
    
    try {
      const client = mqtt.connect(MQTT_CONFIG.broker, {
        username: MQTT_CONFIG.username,
        password: MQTT_CONFIG.password,
        protocol: 'wss',
        reconnectPeriod: 5000,
        connectTimeout: 10000,
      });
      
      client.on('connect', () => {
        setMqttStatus('connected');
        setMqttClient(client);
        setConnectionError(null);
      });
      
      client.on('error', (err) => {
        setMqttStatus('error');
        setConnectionError(err.message || 'Connection failed');
      });
      
      client.on('close', () => {
        setMqttStatus('disconnected');
      });
      
    } catch (err) {
      setMqttStatus('error');
      setConnectionError('Failed to load MQTT library');
    }
  };
  
  // Disconnect from HiveMQ
  const disconnectMQTT = () => {
    if (mqttClient) {
      mqttClient.end();
      setMqttClient(null);
      setMqttStatus('disconnected');
    }
  };
  
  // Cleanup MQTT connection on unmount
  useEffect(() => {
    return () => {
      if (mqttClient) {
        mqttClient.end();
      }
    };
  }, [mqttClient]);
  
  // Send data to HiveMQ
  const sendToHiveMQ = async () => {
    if (!mqttClient || !mqttClient.connected) {
      setConnectionError('Not connected to MQTT broker');
      return;
    }
    
    setMqttStatus('sending');
    
    // Get power prediction using ML model
    let power;
    try {
      const response = await mlAPI.predict(mqttWindSpeed);
      power = Math.round(response.predictedPower);
    } catch (error) {
      console.error('ML prediction failed:', error);
      setConnectionError('ML prediction failed');
      setMqttStatus('error');
      return;
    }
    
    const payload = {
      wind_speed: mqttWindSpeed,
      wind_direction: mqttWindDirection,
      direction_label: getDirectionLabel(mqttWindDirection),
      timestamp: new Date().toISOString(),
      predicted_power: power,
      model: 'Random Forest ML (89.2% accuracy)'
    };
    
    mqttClient.publish(MQTT_CONFIG.topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) {
        setMqttStatus('error');
        setConnectionError('Failed to publish message');
      } else {
        setLastSentData(payload);
        setMqttStatus('sent');
        setTimeout(() => setMqttStatus('connected'), 2000);
      }
    });
  };


  useEffect(() => {
    const sample = generateSampleData();
    setRawData(sample);
    setDataInfo({ startDate: 'Jan 1, 2018', endDate: 'Dec 28, 2018', totalRows: sample.length, year: 2018 });
    
    // Load ML model info
    mlAPI.getModelInfo().then(response => {
      if (response.success) {
        setMlModelInfo(response.model);
      }
    }).catch(err => {
      console.error('Failed to load ML model info:', err);
    });
  }, []);

  // Update MQTT power display when wind speed changes
  useEffect(() => {
    const updateMQTTPower = async () => {
      try {
        const response = await mlAPI.predict(mqttWindSpeed);
        const displayElement = document.getElementById('mqtt-power-display');
        if (displayElement) {
          displayElement.textContent = Math.round(response.predictedPower).toLocaleString();
        }
      } catch (error) {
        console.error('Failed to update MQTT power display:', error);
      }
    };
    updateMQTTPower();
  }, [mqttWindSpeed]);


  const resetFilters = () => { setSelectedMonth('all'); setSelectedWeek('all'); setSelectedDay('all'); setViewMode('monthly'); };


  const availableDays = useMemo(() => {
    if (selectedMonth === 'all') return [];
    const days = new Set();
    rawData.forEach(r => { if (r._parsedDate?.getMonth() === parseInt(selectedMonth)) days.add(r._parsedDate.getDate()); });
    return Array.from(days).sort((a,b) => a - b);
  }, [rawData, selectedMonth]);


  const availableWeeks = useMemo(() => {
    if (selectedMonth === 'all') return [];
    const weeks = new Set();
    rawData.forEach(r => { if (r._parsedDate?.getMonth() === parseInt(selectedMonth)) weeks.add(Math.ceil(r._parsedDate.getDate() / 7)); });
    return Array.from(weeks).sort((a,b) => a - b);
  }, [rawData, selectedMonth]);


  const processedData = useMemo(() => {
    const filtered = rawData.filter(r => {
      const d = r._parsedDate;
      if (!d) return false;
      if (selectedMonth !== 'all' && d.getMonth() !== parseInt(selectedMonth)) return false;
      if (selectedWeek !== 'all' && Math.ceil(d.getDate() / 7) !== parseInt(selectedWeek)) return false;
      if (selectedDay !== 'all' && d.getDate() !== parseInt(selectedDay)) return false;
      return true;
    });
    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    
    const monthlyMap = {}, weeklyMap = {}, dailyMap = {}, hourlyMap = {};
    filtered.forEach(r => {
      const d = r._parsedDate, pwr = parseFloat(r['LV ActivePower (kW)'])||0, wnd = parseFloat(r['Wind Speed (m/s)'])||0;
      const mon = MONTHS[d.getMonth()], day = DAYS[d.getDay()], dt = d.getDate(), hr = d.getHours();
      if (!monthlyMap[mon]) monthlyMap[mon] = { p: [], w: [] }; monthlyMap[mon].p.push(pwr); monthlyMap[mon].w.push(wnd);
      if (!weeklyMap[day]) weeklyMap[day] = { p: [], w: [] }; weeklyMap[day].p.push(pwr); weeklyMap[day].w.push(wnd);
      if (!dailyMap[dt]) dailyMap[dt] = { p: [], w: [] }; dailyMap[dt].p.push(pwr); dailyMap[dt].w.push(wnd);
      if (!hourlyMap[hr]) hourlyMap[hr] = { p: [], w: [] }; hourlyMap[hr].p.push(pwr); hourlyMap[hr].w.push(wnd);
    });
    
    const monthly = MONTHS.filter(m => monthlyMap[m]).map(m => ({ month: m, power: Math.round(avg(monthlyMap[m].p)), windSpeed: +avg(monthlyMap[m].w).toFixed(1), efficiency: Math.round((avg(monthlyMap[m].p)/3500)*100) }));
    const weekly = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].filter(d => weeklyMap[d]).map(d => ({ day: d, power: Math.round(avg(weeklyMap[d].p)), windSpeed: +avg(weeklyMap[d].w).toFixed(1) }));
    const daily = Object.keys(dailyMap).map(Number).sort((a,b)=>a-b).map(d => ({ date: `Day ${d}`, power: Math.round(avg(dailyMap[d].p)), windSpeed: +avg(dailyMap[d].w).toFixed(1) }));
    const hourly = Array.from({length:24},(_,i)=>i).filter(h => hourlyMap[h]).map(h => ({ time: `${h.toString().padStart(2,'0')}:00`, power: Math.round(avg(hourlyMap[h].p)), windSpeed: +avg(hourlyMap[h].w).toFixed(1) }));
    
    const allP = filtered.map(r => parseFloat(r['LV ActivePower (kW)'])||0), allW = filtered.map(r => parseFloat(r['Wind Speed (m/s)'])||0);
    return { monthly, weekly, daily, hourly, stats: { records: filtered.length, avgPower: Math.round(avg(allP)), avgWind: +avg(allW).toFixed(1), maxPower: allP.length ? Math.round(Math.max(...allP)) : 0 }};
  }, [rawData, selectedMonth, selectedWeek, selectedDay]);


  useEffect(() => {
    let isMounted = true;
    const requestId = Math.random().toString(36).substring(7);
    
    const calculatePower = async () => {
      const currentWindSpeed = windInput;
      const currentTurbines = turbineCount;
      const currentArea = areaSize;
      
      console.log(`[${requestId}] NEW REQUEST`);
      console.log(`   Wind: ${currentWindSpeed} m/s`);
      console.log(`   Turbines: ${currentTurbines}`);
      console.log(`   Area: ${currentArea} m²`);
      
      let singleTurbinePower;
      
      try {
        // Use ML model prediction
        console.log(`[${requestId}] Calling ML API...`);
        const startTime = Date.now();
        
        const response = await mlAPI.predict(currentWindSpeed);
        const endTime = Date.now();
        
        console.log(`[${requestId}] API responded in ${endTime - startTime}ms`);
        
        if (!isMounted) {
          console.log(`[${requestId}] Component unmounted, discarding response`);
          return;
        }
        
        // Verify wind speed hasn't changed during API call
        if (currentWindSpeed !== windInput) {
          console.log(`[${requestId}] Wind speed changed during API call (${currentWindSpeed} -> ${windInput}), discarding old response`);
          return;
        }
        
        singleTurbinePower = response.predictedPower;
        
        // Debug logging
        console.log(`[${requestId}] ML Model Response:`);
        console.log(`   Input Wind Speed: ${currentWindSpeed} m/s`);
        console.log(`   Single Turbine Power: ${singleTurbinePower} kW`);
        console.log(`   Response:`, response);
      } catch (error) {
        console.error(`[${requestId}] ML prediction failed:`, error);
        singleTurbinePower = 0;
      }
      
      if (!isMounted) return;
      
      // Apply efficiency based on turbine density
      const eff = Math.max(0.3, 1 - (currentTurbines / currentArea) * 3);
      const totalPower = Math.round(singleTurbinePower * currentTurbines * eff);
      
      // Debug logging
      console.log(`[${requestId}] Calculation:`);
      console.log(`   Turbines: ${currentTurbines}`);
      console.log(`   Area: ${currentArea} m²`);
      console.log(`   Efficiency: ${(eff * 100).toFixed(1)}%`);
      console.log(`   Formula: ${singleTurbinePower} × ${currentTurbines} × ${eff.toFixed(2)}`);
      console.log(`   FINAL: ${totalPower.toLocaleString()} kW`);
      console.log(`[${requestId}] COMPLETE\n`);
      
      setPredictedPower(totalPower);
    };
    
    calculatePower();
    
    return () => {
      console.log(`[${requestId}] Cleanup`);
      isMounted = false;
    };
  }, [windInput, turbineCount, areaSize]);


  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileUploading(true); setParseErrors(0);
    try {
      const text = await file.text(), lines = text.split('\n'), headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      let errCnt = 0, minD = null, maxD = null;
      const data = lines.slice(1).filter(l => l.trim()).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/"/g, '')), row = headers.reduce((o, h, i) => ({ ...o, [h]: vals[i] }), {});
        const pd = parseDate(row['Date/Time']);
        if (pd) { row._parsedDate = pd; if (!minD || pd < minD) minD = pd; if (!maxD || pd > maxD) maxD = pd; } else errCnt++;
        return row;
      }).filter(r => {
        if (!r._parsedDate) return false;
        const power = parseFloat(r['LV ActivePower (kW)']);
        const wind = parseFloat(r['Wind Speed (m/s)']);
        if (!power || power <= 0 || !wind || wind <= 0) { errCnt++; return false; }
        return true;
      });
      setRawData(data); setDataLoaded(true); setParseErrors(errCnt);
      if (minD && maxD) setDataInfo({ startDate: minD.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}), endDate: maxD.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}), totalRows: data.length, year: minD.getFullYear() });
      resetFilters();
    } catch (err) { console.error(err); }
    setFileUploading(false);
  };


  const chartData = viewMode === 'monthly' ? processedData.monthly : viewMode === 'weekly' ? processedData.weekly : viewMode === 'daily' ? processedData.daily : processedData.hourly;
  const chartKey = viewMode === 'monthly' ? 'month' : viewMode === 'weekly' ? 'day' : viewMode === 'daily' ? 'date' : 'time';
  const { stats } = processedData;
  const filterDesc = [dataInfo?.year, selectedMonth !== 'all' && MONTHS[parseInt(selectedMonth)], selectedWeek !== 'all' && `Week ${selectedWeek}`, selectedDay !== 'all' && `Day ${selectedDay}`].filter(Boolean).join(' → ') || 'All Data';
  const isFiltered = selectedMonth !== 'all' || selectedWeek !== 'all' || selectedDay !== 'all';


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="bg-black/30 backdrop-blur-md border-b border-white/10 sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-xl shadow-lg"><Wind className="w-6 h-6 text-white" /></div>
            <div><h1 className="text-xl font-bold text-white">Wind Farm Monitor</h1><p className="text-sm text-gray-400">Digital Twin Dashboard</p></div>
          </div>
          <div className="flex items-center gap-4">
            <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer text-sm transition-all ${dataLoaded ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10'}`}>
              {fileUploading ? <span className="animate-spin">⟳</span> : <Upload className="w-4 h-4" />}
              <span>{dataLoaded ? 'Kaggle Data ✓' : 'Upload T1.csv'}</span>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
            <div className="flex flex-col items-end mr-2">
              <span className="text-sm font-medium text-white">{username}</span>
              <span className="text-xs text-gray-400">{user?.role || 'User'}</span>
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-base shadow-lg">{username[0].toUpperCase()}</div>
            <button onClick={onLogout} className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </header>


      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6 pb-12">
        {dataInfo && (
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-5 py-3 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2 text-sm">
              <Database className="w-4 h-4 text-cyan-400" />
              <span className="text-gray-300">Dataset: <span className="text-white font-medium">{dataInfo.totalRows.toLocaleString()} records</span></span>
              <span className="text-gray-500">|</span>
              <span className="text-gray-300">Period: <span className="text-white">{dataInfo.startDate} — {dataInfo.endDate}</span></span>
            </div>
            {parseErrors > 0 && <div className="flex items-center gap-1 text-yellow-400 text-xs"><AlertCircle className="w-3 h-3" /><span>{parseErrors.toLocaleString()} rows filtered (zero/invalid values)</span></div>}
          </div>
        )}


        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-cyan-400" />
              <span className="text-base font-semibold text-white">Data Filters</span>
              <span className="text-sm text-gray-400 ml-3">→ {filterDesc}</span>
            </div>
            {isFiltered && <button onClick={resetFilters} className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-all"><RotateCcw className="w-4 h-4" />Reset Filters</button>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Dropdown label="Month" value={selectedMonth} options={[{value:'all',label:'All Months'}, ...MONTHS.map((m,i) => ({value:i.toString(),label:m}))]} onChange={(v) => { setSelectedMonth(v); setSelectedWeek('all'); setSelectedDay('all'); }} />
            <Dropdown label="Week of Month" value={selectedWeek} options={[{value:'all',label:'All Weeks'}, ...availableWeeks.map(w => ({value:w.toString(),label:`Week ${w}`}))]} onChange={(v) => { setSelectedWeek(v); setSelectedDay('all'); }} disabled={selectedMonth === 'all'} />
            <Dropdown label="Specific Day" value={selectedDay} options={[{value:'all',label:'All Days'}, ...availableDays.map(d => ({value:d.toString(),label:`Day ${d}`}))]} onChange={setSelectedDay} disabled={selectedMonth === 'all'} />
            <Dropdown label="View Mode" value={viewMode} options={[{value:'monthly',label:'Monthly'},{value:'weekly',label:'By Day of Week'},{value:'daily',label:'By Date'},{value:'hourly',label:'Hourly'}]} onChange={setViewMode} />
          </div>
        </div>


        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard icon={Database} title="Filtered Records" value={stats.records.toLocaleString()} unit="rows" color="bg-purple-500" />
          <StatCard icon={Zap} title="Avg Power" value={stats.avgPower.toLocaleString()} unit="kW" color="bg-cyan-500" />
          <StatCard icon={Wind} title="Avg Wind" value={stats.avgWind} unit="m/s" color="bg-blue-500" />
          <StatCard icon={Gauge} title="Peak Power" value={stats.maxPower.toLocaleString()} unit="kW" color="bg-green-500" />
        </div>


        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 shadow-lg">
            <h2 className="text-base font-semibold text-white mb-5">Power & Wind — {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} View</h2>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData}>
                <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/><stop offset="95%" stopColor="#06b6d4" stopOpacity={0.1}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey={chartKey} stroke="#9ca3af" fontSize={10} />
                <YAxis yAxisId="left" stroke="#06b6d4" fontSize={10} />
                <YAxis yAxisId="right" orientation="right" stroke="#a855f7" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar yAxisId="left" dataKey="power" fill="url(#pg)" name="Power (kW)" radius={[3,3,0,0]} />
                <Line yAxisId="right" type="monotone" dataKey="windSpeed" stroke="#a855f7" strokeWidth={2} dot={false} name="Wind (m/s)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 shadow-lg">
            <h2 className="text-base font-semibold text-white mb-5">Monthly Efficiency</h2>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={processedData.monthly}>
                <defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/><stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={10} />
                <YAxis stroke="#9ca3af" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Area type="monotone" dataKey="efficiency" stroke="#10b981" fill="url(#eg)" name="Efficiency %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>


        <div className="bg-gradient-to-r from-purple-500/10 to-cyan-500/10 backdrop-blur-sm rounded-xl p-6 border border-white/10 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2"><TrendingUp className="w-5 h-5 text-cyan-400" />Power Prediction Simulator (ML Model)</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{useManualInput ? 'Manual' : 'Slider'}</span>
              <button
                onClick={() => setUseManualInput(!useManualInput)}
                className={`relative w-12 h-6 rounded-full transition-colors ${useManualInput ? 'bg-purple-500' : 'bg-cyan-500'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${useManualInput ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
          {mlModelInfo && (
            <div className="mb-4 p-3 bg-black/20 rounded-lg border border-green-500/30">
              <p className="text-xs text-gray-400 mb-1">Random Forest Model (89.2% accuracy)</p>
              <p className="text-xs text-green-400">Trained on 50,530 samples • 100 trees • MAE: 181.72 kW</p>
              <div className="mt-2 pt-2 border-t border-white/10 text-xs text-gray-500 font-mono">
                Formula: Single Turbine × Count × Efficiency = {predictedPower.toLocaleString()} kW
              </div>
            </div>
          )}
          <div className="grid md:grid-cols-4 gap-5">
            <div>
              <label className="block text-sm text-gray-400 mb-3 font-medium">Wind Speed: <span className="text-cyan-400 font-semibold">{windInput} m/s</span></label>
              {!useManualInput ? (
                <input type="range" min="0" max="25" step="0.5" value={windInput} onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  console.log('Slider changed to:', val);
                  setWindInput(val);
                }} className="w-full h-2.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500" />
              ) : (
                <input type="number" min="0" max="25" step="0.5" value={windInput} onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  console.log('Manual input changed to:', val);
                  setWindInput(isNaN(val) ? 0 : Math.max(0, Math.min(25, val)));
                }} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-cyan-400" placeholder="0-25" />
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-3 font-medium">Turbines: <span className="text-purple-400 font-semibold">{turbineCount}</span></label>
              {!useManualInput ? (
                <input type="range" min="1" max="50" value={turbineCount} onChange={(e) => {
                  const val = parseInt(e.target.value);
                  console.log('Turbines changed to:', val);
                  setTurbineCount(val);
                }} className="w-full h-2.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500" />
              ) : (
                <input type="number" min="1" max="50" value={turbineCount} onChange={(e) => {
                  const val = parseInt(e.target.value);
                  console.log('Turbines changed to:', val);
                  setTurbineCount(isNaN(val) ? 1 : Math.max(1, Math.min(50, val)));
                }} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-purple-400" placeholder="1-50" />
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-3 font-medium">Area: <span className="text-green-400 font-semibold">{areaSize} m²</span></label>
              {!useManualInput ? (
                <input type="range" min="100" max="1000" step="50" value={areaSize} onChange={(e) => {
                  const val = parseInt(e.target.value);
                  console.log('Area changed to:', val);
                  setAreaSize(val);
                }} className="w-full h-2.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-green-500" />
              ) : (
                <input type="number" min="100" max="1000" step="50" value={areaSize} onChange={(e) => {
                  const val = parseInt(e.target.value);
                  console.log('Area changed to:', val);
                  setAreaSize(isNaN(val) ? 100 : Math.max(100, Math.min(1000, val)));
                }} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="100-1000" />
              )}
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center border border-white/10 shadow-md"><p className="text-sm text-gray-400 mb-1">Predicted Power</p><p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">{predictedPower.toLocaleString()}</p><p className="text-sm text-gray-500 mt-1">kW</p></div>
          </div>
        </div>


        {/* HiveMQ Unity Simulator */}
        <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 backdrop-blur-sm rounded-xl p-6 border border-green-500/20 shadow-lg">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-green-400" />
              Unity Live Feed (HiveMQ)
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{useMqttManualInput ? 'Manual' : 'Slider'}</span>
                <button
                  onClick={() => setUseMqttManualInput(!useMqttManualInput)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${useMqttManualInput ? 'bg-emerald-500' : 'bg-green-500'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${useMqttManualInput ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
              <div className="h-6 w-px bg-white/20"></div>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${mqttStatus === 'connected' || mqttStatus === 'sent' ? 'bg-green-400 shadow-lg shadow-green-400/50' : mqttStatus === 'connecting' || mqttStatus === 'sending' ? 'bg-yellow-400 animate-pulse' : mqttStatus === 'error' ? 'bg-red-400' : 'bg-gray-500'}`} />
                <span className="text-sm text-gray-400 font-medium">
                  {mqttStatus === 'connected' ? 'Connected' : mqttStatus === 'connecting' ? 'Connecting...' : mqttStatus === 'sending' ? 'Sending...' : mqttStatus === 'sent' ? 'Sent!' : mqttStatus === 'error' ? 'Error' : 'Disconnected'}
                </span>
              </div>
              {mqttStatus === 'disconnected' || mqttStatus === 'error' ? (
                <button onClick={connectMQTT} className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-xs transition-all">Connect</button>
              ) : mqttStatus !== 'connecting' && (
                <button onClick={disconnectMQTT} className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs transition-all">Disconnect</button>
              )}
            </div>
          </div>
          
          {connectionError && (
            <div className="mb-4 p-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-3 h-3" />
              {connectionError}
            </div>
          )}
          
          <div className="grid md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-2">Wind Speed: <span className="text-green-400 font-medium">{mqttWindSpeed} m/s</span></label>
              {!useMqttManualInput ? (
                <>
                  <input type="range" min="0" max="25" step="0.5" value={mqttWindSpeed} onChange={(e) => setMqttWindSpeed(parseFloat(e.target.value))} className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-green-500" />
                  <div className="flex justify-between text-xs text-gray-500 mt-1"><span>0</span><span>25</span></div>
                </>
              ) : (
                <input type="number" min="0" max="25" step="0.5" value={mqttWindSpeed} onChange={(e) => setMqttWindSpeed(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="0-25" />
              )}
            </div>
            
            <div>
              <label className="block text-xs text-gray-400 mb-2">Wind Direction: <span className="text-emerald-400 font-medium">{mqttWindDirection}° ({getDirectionLabel(mqttWindDirection)})</span></label>
              {!useMqttManualInput ? (
                <>
                  <input type="range" min="0" max="359" step="1" value={mqttWindDirection} onChange={(e) => setMqttWindDirection(parseInt(e.target.value))} className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-500" />
                  <div className="flex justify-between text-xs text-gray-500 mt-1"><span>N</span><span>S</span><span>N</span></div>
                </>
              ) : (
                <input type="number" min="0" max="359" step="1" value={mqttWindDirection} onChange={(e) => setMqttWindDirection(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="0-359" />
              )}
            </div>
            
            <div className="flex items-center justify-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-white/20" />
                <div className="absolute inset-2 rounded-full bg-white/5 flex items-center justify-center">
                  <Navigation className="w-6 h-6 text-green-400 transition-transform duration-300" style={{ transform: `rotate(${mqttWindDirection}deg)` }} />
                </div>
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-xs text-gray-500">N</span>
                <span className="absolute top-1/2 -right-1 -translate-y-1/2 text-xs text-gray-500">E</span>
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-xs text-gray-500">S</span>
                <span className="absolute top-1/2 -left-1 -translate-y-1/2 text-xs text-gray-500">W</span>
              </div>
            </div>
            
            <div className="bg-white/5 rounded-lg p-3 text-center border border-white/10">
              <p className="text-xs text-gray-400">ML Prediction</p>
              <p className="text-xl font-bold text-green-400" id="mqtt-power-display">---</p>
              <p className="text-xs text-gray-500">kW (single turbine)</p>
              <p className="text-xs text-green-600 mt-1">Random Forest</p>
            </div>
            
            <div className="flex flex-col justify-center">
              <button onClick={sendToHiveMQ} disabled={mqttStatus !== 'connected' && mqttStatus !== 'sent'}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${mqttStatus === 'sending' ? 'bg-yellow-500/20 text-yellow-400' : mqttStatus === 'sent' ? 'bg-green-500/30 text-green-400' : mqttStatus === 'connected' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-500/20 text-gray-500 cursor-not-allowed'}`}>
                <Send className="w-4 h-4" />
                {mqttStatus === 'sending' ? 'Sending...' : mqttStatus === 'sent' ? 'Sent ✓' : 'Send to Unity'}
              </button>
              <p className="text-xs text-gray-500 text-center mt-2">Topic: {MQTT_CONFIG.topic}</p>
            </div>
          </div>
          
          {lastSentData && (
            <div className="mt-4 p-3 bg-black/20 rounded-lg border border-white/10">
              <p className="text-xs text-gray-400 mb-1">Last Sent Payload:</p>
              <code className="text-xs text-green-400 font-mono break-all">{JSON.stringify(lastSentData)}</code>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};


export default function App() {
  const [user, setUser] = useState(null);
  const [showSignup, setShowSignup] = useState(false);
  
  // Check for existing session on mount
  useEffect(() => {
    const storedUser = getUserData();
    if (storedUser) {
      setUser(storedUser);
    }
  }, []);
  
  const handleLogout = () => {
    removeAuthToken();
    removeUserData();
    setUser(null);
  };
  
  if (user) {
    return <Dashboard user={user} onLogout={handleLogout} />;
  }
  
  if (showSignup) {
    return (
      <SignupPage 
        onSignup={setUser} 
        onBackToLogin={() => setShowSignup(false)} 
      />
    );
  }
  
  return <LoginPage onLogin={setUser} onShowSignup={() => setShowSignup(true)} />;
}