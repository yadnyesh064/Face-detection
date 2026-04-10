import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Activity, AlertTriangle, Crosshair, Eye, Heart, ActivitySquare, ShieldAlert } from 'lucide-react';
import { LineChart, Line, YAxis, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

// --- Types ---
type Telemetry = {
  fps: number;
  faces_detected: number;
  threat_score: number;
  heart_rate: number;
  emotions: { stress: number; focus: number; anxiety: number };
  head_pose: { pitch: number; yaw: number; roll: number };
  mesh_points: { x: number; y: number; z: number }[];
  system_error: string | null;
};

type HeartRateDataPoint = { time: string; bpm: number };
type ThreatDataPoint = { time: string; score: number };

// --- Subcomponents ---

const FaceMeshOverlay = ({ points }: { points: Telemetry['mesh_points'] }) => {
  if (!points || points.length === 0) return null;
  
  const positions = points.map(p => [(p.x - 0.5) * 4, -(p.y - 0.5) * 4, -p.z * 10] as [number, number, number]);

  return (
    <group>
      {positions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <boxGeometry args={[0.015, 0.015, 0.015]} />
          <meshBasicMaterial color={i === 1 ? "#3b82f6" : "#e4e4e7"} transparent opacity={0.6} />
        </mesh>
      ))}
      <gridHelper args={[10, 10, '#3f3f46', '#27272a']} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
};

// --- Main App ---

export default function App() {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [hrHistory, setHrHistory] = useState<HeartRateDataPoint[]>([]);
  const [threatHistory, setThreatHistory] = useState<ThreatDataPoint[]>([]);
  const [connStatus, setConnStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'>('DISCONNECTED');
  
  const ws = useRef<WebSocket | null>(null);

  const connectWS = () => {
    setConnStatus('CONNECTING');
    ws.current = new WebSocket('ws://127.0.0.1:8000/ws/video');
    
    ws.current.onopen = () => {
      setConnStatus('CONNECTED');
    }
    
    ws.current.onclose = () => {
      setConnStatus('DISCONNECTED');
      // Auto-reconnect after 3 seconds
      setTimeout(connectWS, 3000);
    };
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.image) {
        setImageSrc(`data:image/jpeg;base64,${data.image}`);
      } else {
        setImageSrc(null);
      }
      
      if (data.telemetry) {
        setTelemetry(data.telemetry);
        const now = new Date().toLocaleTimeString().split(' ')[0];
        
        // Update history only if we have active detection or just for telemetry tracking
        setHrHistory(prev => {
          const val = data.telemetry.heart_rate || (prev.length > 0 ? prev[prev.length-1].bpm : 60);
          const newHistory = [...prev, { time: now, bpm: val }];
          return newHistory.length > 50 ? newHistory.slice(1) : newHistory;
        });

        setThreatHistory(prev => {
          const val = data.telemetry.threat_score || 0;
          const newHistory = [...prev, { time: now, score: val }];
          return newHistory.length > 50 ? newHistory.slice(1) : newHistory;
        });
      }
    };
  };

  useEffect(() => {
    connectWS();
    return () => {
      ws.current?.close();
    };
  }, []);

  const getThreatColor = (score: number) => {
    if (score > 12) return 'text-brand-rose';
    if (score > 8) return 'text-amber-500';
    return 'text-brand-emerald';
  };

  return (
    <div className="min-h-screen bg-brand-dark text-brand-text font-sans p-6">
      
      {/* Header */}
      <header className="flex justify-between items-center bg-brand-card border border-brand-border rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-blue/10 rounded-xl">
            <ActivitySquare className="text-brand-blue" size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Face Analytics Dashboard</h1>
            <p className="text-sm text-brand-muted font-medium mt-1">Real-time Biometric & Threat Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-8 bg-brand-dark px-6 py-3 rounded-xl border border-brand-border">
          <div className="text-right">
            <p className="text-xs text-brand-muted uppercase font-semibold">Backend Port: 8000</p>
            <div className="flex items-center justify-end gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${connStatus === 'CONNECTED' ? 'bg-brand-emerald animate-pulse' : connStatus === 'CONNECTING' ? 'bg-amber-400 animate-bounce' : 'bg-brand-rose'}`} />
              <p className={`font-semibold text-sm ${connStatus === 'CONNECTED' ? 'text-brand-emerald' : connStatus === 'CONNECTING' ? 'text-amber-400' : 'text-brand-rose'}`}>
                {connStatus}
              </p>
            </div>
          </div>
          <div className="w-px h-8 bg-brand-border" />
          <div className="text-right">
            <p className="text-xs text-brand-muted uppercase font-semibold">AI Kernel FPS</p>
            <p className="font-semibold text-white text-sm mt-1">{telemetry?.fps || 0} Hz</p>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Column: Metrics */}
        <aside className="col-span-1 flex flex-col gap-6">
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-md transition-all">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-brand-rose/10 rounded-lg">
                <Heart className="text-brand-rose" size={20} />
              </div>
              <h2 className="text-base font-semibold text-white">rPPG Vital Signs</h2>
            </div>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-5xl font-bold text-white tracking-tight">{telemetry?.heart_rate ? telemetry.heart_rate.toFixed(1) : '--'}</span>
              <span className="text-sm text-brand-muted font-medium">BPM</span>
            </div>
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hrHistory}>
                  <defs>
                    <linearGradient id="colorBpm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="bpm" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorBpm)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-md flex-1">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-brand-teal/10 rounded-lg">
                <Eye className="text-brand-teal" size={20} />
              </div>
              <h2 className="text-base font-semibold text-white">Micro-Expressions</h2>
            </div>
            
            <div className="space-y-6">
              {['stress', 'focus', 'anxiety'].map((emotion) => {
                const val = telemetry?.emotions[emotion as keyof Telemetry['emotions']] || 0;
                return (
                  <div key={emotion}>
                    <div className="flex justify-between text-sm mb-2 font-medium">
                      <span className="capitalize text-brand-text">{emotion}</span>
                      <span className="text-brand-muted">{(val * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-brand-dark h-2 rounded-full overflow-hidden">
                      <motion.div 
                        className={`h-full rounded-full ${emotion === 'stress' ? 'bg-brand-rose' : emotion === 'focus' ? 'bg-brand-blue' : 'bg-brand-teal'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${val * 100}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Center Canvas: Holographic & Camera Feed */}
        <section className="col-span-1 lg:col-span-2 flex flex-col gap-6">
          <div className="relative bg-brand-dark border border-brand-border rounded-2xl overflow-hidden shadow-lg flex-1 min-h-[500px]">
            {/* Camera Feed */}
            <div className="absolute inset-0 z-0 bg-brand-card">
              {imageSrc ? (
                <img src={imageSrc} alt="Feed" className="w-full h-full object-cover opacity-80 mix-blend-luminosity" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-brand-muted p-8 text-center">
                  {telemetry?.system_error ? (
                    <div className="flex flex-col items-center gap-4 bg-brand-rose/10 p-8 rounded-3xl border border-brand-rose/20 max-w-md">
                      <ShieldAlert size={48} className="text-brand-rose animate-pulse" />
                      <p className="text-lg font-bold text-white uppercase tracking-tight">Backend System Error</p>
                      <p className="text-sm font-medium leading-relaxed opacity-80">{telemetry.system_error}</p>
                      <button 
                        onClick={() => window.location.reload()}
                        className="mt-4 px-6 py-2 bg-brand-rose text-white rounded-xl text-xs font-bold hover:bg-rose-600 transition-colors"
                      >
                        RETRY CONNECTION
                      </button>
                    </div>
                  ) : connStatus === 'CONNECTED' ? (
                    <div className="flex flex-col items-center gap-4">
                      <Activity size={32} className="animate-spin text-brand-blue" />
                      <p className="text-sm font-medium tracking-widest uppercase text-brand-blue">Acquiring Camera Stream...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 rounded-full border-2 border-brand-muted/20 border-t-brand-muted animate-spin" />
                      <p className="text-sm font-medium tracking-widest uppercase">Connecting to Localhost:8000...</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="absolute inset-0 z-10 pointer-events-none">
              <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
                <ambientLight intensity={0.8} />
                <pointLight position={[10, 10, 10]} intensity={1.5} color="#ffffff" />
                <FaceMeshOverlay points={telemetry?.mesh_points || []} />
                <OrbitControls enableZoom={false} enablePan={false} autoRotate={!telemetry?.faces_detected} />
              </Canvas>
            </div>

            <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
               <Crosshair className="text-white opacity-10 w-1/3 h-1/3" strokeWidth={1} />
               {telemetry?.faces_detected && telemetry.faces_detected > 0 && (
                 <motion.div 
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-80 border-2 border-brand-blue/50 rounded-3xl shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)]" 
                 />
               )}
            </div>

            <div className="absolute top-4 left-4 z-20 flex gap-2">
              <span className="bg-brand-dark/80 backdrop-blur text-brand-text text-[10px] font-bold px-3 py-1.5 rounded-lg border border-brand-border/50 uppercase tracking-widest">
                Optic Cam 01
              </span>
              {connStatus === 'CONNECTED' && (
                <span className={`backdrop-blur text-[10px] font-bold px-3 py-1.5 rounded-lg border uppercase tracking-widest ${telemetry?.system_error ? 'bg-brand-rose/20 text-brand-rose border-brand-rose/30' : 'bg-brand-emerald/20 text-brand-emerald border-brand-emerald/30'}`}>
                  {telemetry?.system_error ? 'Hardware Error' : 'AI Active'}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Threat & Logs */}
        <aside className="col-span-1 flex flex-col gap-6">
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-md transition-all">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <AlertTriangle className="text-amber-500" size={20} />
              </div>
              <h2 className="text-base font-semibold text-white">Anomaly Assessment</h2>
            </div>
            <div className="text-center mb-8">
              <div className={`text-6xl font-bold tracking-tight ${getThreatColor(telemetry?.threat_score || 0)}`}>
                {telemetry?.threat_score?.toFixed(1) || '0.0'}
              </div>
              <p className="text-brand-muted text-sm mt-2 font-medium uppercase tracking-wider">Threat Index</p>
            </div>
            
            <div className="h-32 w-full">
               <ResponsiveContainer width="100%" height="100%">
                <LineChart data={threatHistory}>
                  <YAxis domain={[0, 20]} hide />
                  <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-md flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-brand-emerald/10 rounded-lg">
                <Activity className="text-brand-emerald" size={20} />
              </div>
              <h2 className="text-base font-semibold text-white">Event Log</h2>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 flex flex-col-reverse">
              {threatHistory.slice(-15).reverse().map((log, i) => (
                <div key={i} className="flex flex-col gap-1 pb-3 border-b border-brand-border/50 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-brand-muted font-medium bg-brand-dark px-2 py-0.5 rounded">{log.time}</span>
                    <span className="text-[10px] text-brand-rose font-bold">{log.score > 12 ? 'ALERT' : ''}</span>
                  </div>
                  <span className={`text-xs font-medium ${log.score > 12 ? 'text-brand-rose' : 'text-brand-text'}`}>
                    {log.score > 12 ? 'High anomaly detected' : `Threat score processed: ${log.score.toFixed(2)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>

      </main>
    </div>
  );
}
