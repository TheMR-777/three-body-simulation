/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, Info, SlidersHorizontal, ZoomIn, ZoomOut } from 'lucide-react';

interface BodyParams {
  mass: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  G: number;
  scale: number;
  dt: number;
  subSteps: number;
  bodies: BodyParams[];
}

const PALETTES = [
  { name: 'Vibrant', colors: ['#60A5FA', '#F472B6', '#FBBF24'] },
  { name: 'Cyberpunk', colors: ['#00FFFF', '#FF007F', '#FFF100'] },
  { name: 'Ethereal', colors: ['#A7F3D0', '#C084FC', '#FDA4AF'] },
  { name: 'Inferno', colors: ['#ff4e00', '#ffcc00', '#ffffff'] },
  { name: 'Monochrome', colors: ['#ffffff', '#9ca3af', '#4b5563'] }
];

const TRAIL_STYLES = [
  { id: 'comet', name: 'Comet (Tapered)' },
  { id: 'neon', name: 'Neon String (Solid)' },
  { id: 'stardust', name: 'Stardust (Dotted)' },
];

const SCENARIOS: Scenario[] = [
  {
    id: "figure8",
    name: "Periodic Figure-8",
    description: "A remarkably stable choreography where three equal masses trace a single path in a predictable loop.",
    G: 1,
    scale: 200,
    dt: 0.005,
    subSteps: 20,
    bodies: [
      { mass: 1, x: 0.97000436, y: -0.24308753, vx: 0.4662036850, vy: 0.4323657300, color: "#60A5FA", radius: 4 },
      { mass: 1, x: -0.97000436, y: 0.24308753, vx: 0.4662036850, vy: 0.4323657300, color: "#F472B6", radius: 4 },
      { mass: 1, x: 0, y: 0, vx: -2*0.4662036850, vy: -2*0.4323657300, color: "#FBBF24", radius: 4 },
    ]
  },
  {
    id: "solar",
    name: "Stellar System",
    description: "A central star with two giant planets. A hierarchical arrangement.",
    G: 1,
    scale: 25,
    dt: 0.005,
    subSteps: 40,
    bodies: [
      { mass: 1000, x: 0, y: 0, vx: 0, vy: -0.045355, color: "#FBBF24", radius: 10 },
      { mass: 1, x: 10, y: 0, vx: 0, vy: 10, color: "#60A5FA", radius: 3 },
      { mass: 5, x: 20, y: 0, vx: 0, vy: 7.0710678, color: "#F472B6", radius: 5 },
    ]
  },
  {
    id: "chaotic",
    name: "Chaotic Flow",
    description: "Unpredictable and complex behavior. Watch how tiny differences cascade into massive shifts.",
    G: 1,
    scale: 80,
    dt: 0.005,
    subSteps: 40,
    bodies: [
      { mass: 1, x: 1, y: 0, vx: 0, vy: 0.5, color: "#60A5FA", radius: 4 },
      { mass: 1.5, x: -1, y: -0.5, vx: 0, vy: -0.5, color: "#F472B6", radius: 5 },
      { mass: 0.5, x: 0, y: 1.5, vx: 0.5, vy: 0, color: "#FBBF24", radius: 3 },
    ]
  },
  {
    id: "butterfly",
    name: "Butterfly Effect",
    description: "A delicate initial symmetry that eventually descends into unpredictable chaos.",
    G: 1,
    scale: 120,
    dt: 0.003,
    subSteps: 40,
    bodies: [
      { mass: 1, x: -1, y: 0, vx: 0.4, vy: 0.3, color: "#F472B6", radius: 4 },
      { mass: 1, x: 1, y: 0, vx: 0.4, vy: -0.3, color: "#60A5FA", radius: 4 },
      { mass: 1, x: 0, y: 0, vx: -0.8, vy: 0, color: "#FBBF24", radius: 4 },
    ]
  }
];

const RK4 = {
  getAccelerations(pos: Float64Array, masses: Float64Array, g: number) {
    const a = new Float64Array(pos.length);
    const numBodies = masses.length;
    for (let i = 0; i < numBodies; i++) {
      for (let j = i + 1; j < numBodies; j++) {
        const dx = pos[j * 2] - pos[i * 2];
        const dy = pos[j * 2 + 1] - pos[i * 2 + 1];
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);
        const eps = 0.005; // Softening to prevent singularity explosions
        const forceMag = g / ((distSq + eps) * (dist + eps)); 
        
        const ax_i = forceMag * masses[j] * dx;
        const ay_i = forceMag * masses[j] * dy;
        const ax_j = -forceMag * masses[i] * dx;
        const ay_j = -forceMag * masses[i] * dy;
        
        a[i * 2] += ax_i;
        a[i * 2 + 1] += ay_i;
        a[j * 2] += ax_j;
        a[j * 2 + 1] += ay_j;
      }
    }
    return a;
  },

  step(pos: Float64Array, vel: Float64Array, masses: Float64Array, g: number, dt: number) {
    const v1 = vel.slice();
    const a1 = this.getAccelerations(pos, masses, g);
    
    const pos2 = new Float64Array(pos.length);
    const vel2 = new Float64Array(vel.length);
    for(let i=0; i<pos.length; i++){
        pos2[i] = pos[i] + 0.5 * dt * v1[i];
        vel2[i] = vel[i] + 0.5 * dt * a1[i];
    }
    const a2 = this.getAccelerations(pos2, masses, g);
    
    const pos3 = new Float64Array(pos.length);
    const vel3 = new Float64Array(vel.length);
    for(let i=0; i<pos.length; i++){
        pos3[i] = pos[i] + 0.5 * dt * vel2[i];
        vel3[i] = vel[i] + 0.5 * dt * a2[i];
    }
    const a3 = this.getAccelerations(pos3, masses, g);
    
    const pos4 = new Float64Array(pos.length);
    const vel4 = new Float64Array(vel.length);
    for(let i=0; i<pos.length; i++){
        pos4[i] = pos[i] + dt * vel3[i];
        vel4[i] = vel[i] + dt * a3[i];
    }
    const a4 = this.getAccelerations(pos4, masses, g);
    
    for(let i=0; i<pos.length; i++){
        pos[i] += (dt / 6.0) * (v1[i] + 2*vel2[i] + 2*vel3[i] + vel4[i]);
        vel[i] += (dt / 6.0) * (a1[i] + 2*a2[i] + 2*a3[i] + a4[i]);
    }
  }
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [activeScenario, setActiveScenario] = useState<Scenario>(SCENARIOS[0]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [trailLength, setTrailLength] = useState(240);
  const [timeScale, setTimeScale] = useState(1.0);
  const [gMultiplier, setGMultiplier] = useState(1.0);
  const [activePalette, setActivePalette] = useState(0);
  const [trailStyle, setTrailStyle] = useState('comet');

  const settingsRef = useRef({ trailLength, timeScale, gMultiplier, trailStyle });
  settingsRef.current = { trailLength, timeScale, gMultiplier, trailStyle };

  const zoomTargetRef = useRef(1.0);
  const zoomCurrentRef = useRef(1.0);

  // Use refs for the animation loop to access current state without re-rendering
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const scenarioRef = useRef(activeScenario);
  scenarioRef.current = activeScenario;

  const stateRef = useRef({
    pos: new Float64Array(0),
    vel: new Float64Array(0),
    masses: new Float64Array(0),
    colors: [] as string[],
    colorsRgb: [] as string[],
    radii: [] as number[],
    history: [] as {x: number, y: number}[][],
    canvasWidth: 0,
    canvasHeight: 0
  });

  const updateColors = useCallback((paletteIndex: number) => {
    const palette = PALETTES[paletteIndex].colors;
    const numBodies = stateRef.current.masses.length;
    
    for(let i=0; i<numBodies; i++) {
        const hColor = palette[i % palette.length];
        const hex = hColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b_val = parseInt(hex.substring(4, 6), 16);
        
        stateRef.current.colors[i] = hColor;
        stateRef.current.colorsRgb[i] = `${r}, ${g}, ${b_val}`;
    }
  }, []);

  // Update colors whenever palette changes
  useEffect(() => {
     updateColors(activePalette);
  }, [activePalette, updateColors]);

  const resetState = useCallback(() => {
    const scenario = activeScenario;
    const numBodies = scenario.bodies.length;
    
    // Reset zoom
    zoomTargetRef.current = 1.0;
    
    const pos = new Float64Array(numBodies * 2);
    const vel = new Float64Array(numBodies * 2);
    const masses = new Float64Array(numBodies);
    const colors: string[] = [];
    const colorsRgb: string[] = [];
    const radii: number[] = [];
    const history: {x: number, y: number}[][] = [];
    
    const curPalette = PALETTES[activePalette].colors;
    
    scenario.bodies.forEach((b, i) => {
      pos[i * 2] = b.x;
      pos[i * 2 + 1] = b.y;
      vel[i * 2] = b.vx;
      vel[i * 2 + 1] = b.vy;
      masses[i] = b.mass;
      
      const pColor = curPalette[i % curPalette.length];
      colors.push(pColor);
      
      const hex = pColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b_val = parseInt(hex.substring(4, 6), 16);
      colorsRgb.push(`${r}, ${g}, ${b_val}`);
      
      radii.push(b.radius);
      history.push([]);
    });
    
    stateRef.current = {
      ...stateRef.current,
      pos,
      vel,
      masses,
      colors,
      colorsRgb,
      radii,
      history
    };

    const canvas = canvasRef.current;
    if(canvas) {
       const ctx = canvas.getContext('2d');
       if(ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
       }
    }
  }, [activeScenario]);

  useEffect(() => {
    resetState();
  }, [resetState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animationFrameId: number;
    
    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      stateRef.current.canvasWidth = canvas.width;
      stateRef.current.canvasHeight = canvas.height;
    };
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const delta = -e.deltaY * zoomSensitivity;
      zoomTargetRef.current = Math.max(0.05, Math.min(20, zoomTargetRef.current * Math.exp(delta)));
    };
    
    window.addEventListener('resize', handleResize);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    handleResize(); 
    
    const loop = () => {
      animationFrameId = requestAnimationFrame(loop);
      
      if(!isPlayingRef.current) return;

      const state = stateRef.current;
      if(state.masses.length === 0) return;
      const scenario = scenarioRef.current;
      
      // Clear canvas each frame for perfectly clean trails 
      ctx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
      
      const currentSettings = settingsRef.current;
      for(let s = 0; s < scenario.subSteps; s++) {
        RK4.step(state.pos, state.vel, state.masses, scenario.G * currentSettings.gMultiplier, scenario.dt * currentSettings.timeScale);
      }
      
      // Smoothly interpolate zoom
      zoomCurrentRef.current += (zoomTargetRef.current - zoomCurrentRef.current) * 0.1;
      const currentScale = scenario.scale * zoomCurrentRef.current;
      
      // Center Camera on Center of Mass
      let xCom = 0, yCom = 0, mTotal = 0;
      const numBodies = state.masses.length;
      for(let i=0; i<numBodies; i++) {
          xCom += state.pos[i*2] * state.masses[i];
          yCom += state.pos[i*2+1] * state.masses[i];
          mTotal += state.masses[i];
      }
      xCom /= mTotal;
      yCom /= mTotal;
      
      const cx = state.canvasWidth / 2;
      const cy = state.canvasHeight / 2;
      
      // Update history and render trails
      ctx.globalCompositeOperation = 'screen';
      
      for(let i=0; i<numBodies; i++) {
          const x = cx + (state.pos[i*2] - xCom) * currentScale;
          const y = cy + (state.pos[i*2+1] - yCom) * currentScale;
          
          state.history[i].push({x, y});
          const targetLength = settingsRef.current.trailLength;
          while (state.history[i].length > targetLength) {
              state.history[i].shift();
          }

          const hist = state.history[i];
          const curTrailStyle = settingsRef.current.trailStyle;
          
          if (hist.length > 1) {
             if (curTrailStyle === 'stardust') {
                 // Dotted trail
                 for (let j = 1; j < hist.length; j+=4) { // dot spacing
                    const progress = j / hist.length;
                    const alpha = Math.pow(progress, 2) * 0.9;
                    const dotRadius = state.radii[i] * (0.2 + 0.6 * progress);
                    
                    ctx.beginPath();
                    ctx.arc(hist[j].x, hist[j].y, dotRadius, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${state.colorsRgb[i]}, ${alpha})`;
                    ctx.fill();
                 }
             } else {
                 // Connected line trails
                 for (let j = 1; j < hist.length; j++) {
                    ctx.beginPath();
                    ctx.moveTo(hist[j-1].x, hist[j-1].y);
                    ctx.lineTo(hist[j].x, hist[j].y);
                    
                    const progress = j / hist.length;
                    
                    if (curTrailStyle === 'comet') {
                        const alpha = Math.pow(progress, 3);
                        ctx.strokeStyle = `rgba(${state.colorsRgb[i]}, ${alpha})`;
                        ctx.lineWidth = state.radii[i] * (0.1 + 1.2 * progress);
                    } else if (curTrailStyle === 'neon') {
                        const alpha = progress * 0.7; // Linear fade
                        ctx.strokeStyle = `rgba(${state.colorsRgb[i]}, ${alpha})`;
                        ctx.lineWidth = state.radii[i] * 0.9;
                    }
                    
                    ctx.lineCap = 'round';
                    ctx.stroke();
                 }
             }
          }
          
          // Outer Glow at the current head
          ctx.beginPath();
          ctx.arc(x, y, state.radii[i] * 1.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${state.colorsRgb[i]}, 0.8)`;
          ctx.shadowBlur = Math.max(12, state.radii[i] * 2);
          ctx.shadowColor = state.colors[i];
          ctx.fill();
          
          // Inner core (bright)
          ctx.beginPath();
          ctx.arc(x, y, state.radii[i] * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 0;
          ctx.fill();
      }
      
      ctx.globalCompositeOperation = 'source-over'; // reset
    };
    
    loop();
    
    return () => {
       window.removeEventListener('resize', handleResize);
       canvas.removeEventListener('wheel', handleWheel);
       cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="w-screen h-screen bg-[#0A0A0C] text-[#E2E2E2] font-sans flex flex-col relative selection:bg-white/20 overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none z-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
      
      {/* Top Header Navigation */}
      <nav className="h-16 border-b border-white/10 flex items-center justify-between px-8 z-10 bg-[#0A0A0C]/40 backdrop-blur-md relative">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 border border-white/40 rotate-45 flex items-center justify-center text-[10px] font-bold">3B</div>
          <h1 className="text-xs tracking-[0.3em] uppercase font-light hidden sm:block">Celestial Mechanics / <span className="font-semibold opacity-60">The Three-Body Problem</span></h1>
        </div>
        <div className="flex space-x-6 text-[10px] uppercase tracking-widest text-white/50">
          <span className="text-white border-b border-white/40 pb-1 cursor-pointer">Simulation</span>
        </div>
      </nav>

      <main className="flex-1 flex relative overflow-hidden">
        {/* Main Simulation Canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 z-0 bg-transparent" />
        
        {/* Info Panel over Canvas */}
        <AnimatePresence>
           {showInfo && (
              <motion.div 
                 initial={{ opacity: 0, x: -20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -20 }}
                 className="absolute top-12 left-12 w-64 space-y-8 z-10 pointer-events-none"
              >
                 <div className="pointer-events-auto">
                    <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Current State</p>
                    <motion.h2 
                       key={`name-${activeScenario.id}`}
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 1 }}
                       className="text-2xl font-serif italic text-white/90 leading-tight"
                    >
                       {activeScenario.name}
                    </motion.h2>
                    <motion.p 
                       key={`desc-${activeScenario.id}`}
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 1 }}
                       className="text-xs text-white/50 leading-relaxed mt-3"
                    >
                       {activeScenario.description}
                    </motion.p>
                 </div>
                 
                 <div className="grid grid-cols-1 gap-4 pointer-events-auto">
                    <div className="p-4 border border-white/5 bg-white/[0.02] rounded-sm">
                       <div className="flex justify-between items-end">
                       <span className="text-[9px] uppercase tracking-tighter text-white/40">Gravitational Constant</span>
                       <span className="text-xs font-mono">G = {activeScenario.G.toExponential(2)}</span>
                       </div>
                    </div>
                 </div>
              </motion.div>
           )}
        </AnimatePresence>

        {/* Controls Container Bottom Right */}
        <div className="absolute bottom-12 right-12 flex flex-col space-y-6 z-10 pointer-events-none items-end">
           
           <AnimatePresence>
             {showSettings && (
               <motion.div 
                 initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                 animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                 exit={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                 className="w-64 p-6 bg-[#141417]/80 backdrop-blur-xl border border-white/10 rounded-2xl pointer-events-auto shadow-2xl flex flex-col gap-6 origin-bottom-right"
               >
                 <div className="flex justify-between items-center">
                   <span className="text-[10px] uppercase tracking-widest text-white/40">Parameters</span>
                   <button onClick={() => { 
                      setTimeScale(1); 
                      setGMultiplier(1); 
                      setTrailLength(240); 
                      setActivePalette(0);
                      setTrailStyle('comet');
                      zoomTargetRef.current = 1.0;
                   }} className="text-[9px] uppercase hover:text-white text-white/30 transition-colors">Reset</button>
                 </div>
                 
                 <div className="flex flex-col gap-5 overflow-y-auto max-h-[60vh] pr-1 -mr-1 custom-scrollbar">
                   {/* Aesthetics Section */}
                   <div className="flex flex-col gap-3">
                      <div className="flex justify-between text-[10px] items-center">
                        <span className="text-white/60 uppercase tracking-wider">Color Palette</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                         {PALETTES.map((p, i) => (
                            <button 
                               key={i} 
                               onClick={() => setActivePalette(i)}
                               className={`py-1.5 px-2 rounded-md text-[10px] transition-all flex items-center justify-between border ${activePalette === i ? 'border-white/30 bg-white/10 text-white' : 'border-white/5 bg-white/[0.02] text-white/50 hover:bg-white/5'}`}
                            >
                               {p.name}
                               <div className="flex -space-x-1">
                                 {p.colors.map((c, j) => (
                                    <div key={j} className="w-2.5 h-2.5 rounded-full border border-[#141417]" style={{background: c}}></div>
                                 ))}
                               </div>
                            </button>
                         ))}
                      </div>
                   </div>

                   <div className="flex flex-col gap-3">
                      <div className="flex justify-between text-[10px] items-center">
                        <span className="text-white/60 uppercase tracking-wider">Trail Style</span>
                      </div>
                      <div className="flex gap-2">
                         {TRAIL_STYLES.map((ts) => (
                            <button 
                               key={ts.id} 
                               onClick={() => setTrailStyle(ts.id)}
                               className={`flex-1 py-1.5 px-2 rounded-md text-[10px] transition-all border ${trailStyle === ts.id ? 'border-white/30 bg-white/10 text-white' : 'border-white/5 bg-white/[0.02] text-white/50 hover:bg-white/5'}`}
                            >
                               {ts.name.split(' ')[0]}
                            </button>
                         ))}
                      </div>
                   </div>

                   {/* Simulation Controls Section */}
                   <div className="h-px w-full bg-white/10 my-1"></div>

                   <div className="flex flex-col gap-3">
                      <div className="flex justify-between text-[10px] items-center">
                        <span className="text-white/60 uppercase tracking-wider">Time Scale</span>
                        <span className="font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded">{timeScale.toFixed(2)}x</span>
                      </div>
                      <input type="range" min="0.1" max="5" step="0.1" value={timeScale} onChange={(e) => setTimeScale(parseFloat(e.target.value))} className="w-full h-0.5 bg-white/20 appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(255,255,255,0.8)] [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-[0_0_8px_rgba(255,255,255,0.8)] cursor-pointer" />
                   </div>

                   <div className="flex flex-col gap-3">
                      <div className="flex justify-between text-[10px] items-center">
                        <span className="text-white/60 uppercase tracking-wider">Gravity (G)</span>
                        <span className="font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded">{gMultiplier.toFixed(2)}x</span>
                      </div>
                      <input type="range" min="0" max="3" step="0.05" value={gMultiplier} onChange={(e) => setGMultiplier(parseFloat(e.target.value))} className="w-full h-0.5 bg-white/20 appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(255,255,255,0.8)] [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-[0_0_8px_rgba(255,255,255,0.8)] cursor-pointer" />
                   </div>

                   <div className="flex flex-col gap-3">
                      <div className="flex justify-between text-[10px] items-center">
                        <span className="text-white/60 uppercase tracking-wider">Trail Length</span>
                        <span className="font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded">{trailLength}</span>
                      </div>
                      <input type="range" min="0" max="1000" step="10" value={trailLength} onChange={(e) => setTrailLength(parseInt(e.target.value))} className="w-full h-0.5 bg-white/20 appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(255,255,255,0.8)] [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-[0_0_8px_rgba(255,255,255,0.8)] cursor-pointer" />
                   </div>

                   <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 mt-1">
                      <div className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-2">
                        <ZoomIn size={12} /> Scroll to Zoom <ZoomOut size={12} />
                      </div>
                   </div>
                 </div>
               </motion.div>
             )}
           </AnimatePresence>

           <div className="flex justify-end items-center space-x-3 pointer-events-auto">
              <div className="text-right mr-2 hidden sm:block">
                <p className="text-[9px] uppercase tracking-widest text-white/40">Observer View</p>
                <p className="text-[11px] font-medium uppercase text-white/70">Eulerian Frame</p>
              </div>
              <button 
                 onClick={() => setShowSettings(!showSettings)} 
                 className={`w-10 h-10 border border-white/20 flex items-center justify-center rounded-full cursor-pointer hover:bg-white/5 transition-colors ${showSettings ? 'text-white bg-white/10' : 'text-white/40'}`}
                 title="Simulation Parameters"
              >
                 <SlidersHorizontal size={16} strokeWidth={1.5} />
              </button>
              <button 
                 onClick={() => setShowInfo(!showInfo)} 
                 className={`w-10 h-10 border border-white/20 flex items-center justify-center rounded-full cursor-pointer hover:bg-white/5 transition-colors ${showInfo ? 'text-white' : 'text-white/40'}`}
                 title="Toggle Info"
              >
                 <Info size={16} strokeWidth={1.5} />
              </button>
              <button 
                 onClick={resetState} 
                 className="w-10 h-10 border border-white/20 flex items-center justify-center rounded-full cursor-pointer hover:bg-white/5 text-white/40 transition-colors"
                 title="Reset"
              >
                 <RotateCcw size={16} strokeWidth={1.5} />
              </button>
              <button 
                 onClick={() => setIsPlaying(!isPlaying)} 
                 className="w-10 h-10 border border-white/20 flex items-center justify-center rounded-full cursor-pointer hover:bg-white/5 text-white/80 transition-colors"
                 title={isPlaying ? "Pause" : "Play"}
              >
                 {isPlaying ? <Pause size={14} className="fill-current" /> : <Play size={14} className="fill-current ml-0.5" />} 
              </button>
           </div>

           {/* Scenario Pills Segmented Control */}
           <div className="bg-[#141417] p-1 rounded-full border border-white/10 flex pointer-events-auto">
              {SCENARIOS.map(s => (
                 <button 
                    key={s.id} 
                    onClick={() => {
                       setActiveScenario(s);
                       setIsPlaying(true);
                    }}
                    className={`px-6 py-2 rounded-full text-[10px] uppercase tracking-widest transition-colors ${
                       activeScenario.id === s.id ? 'bg-white/10 text-white font-medium shadow-xl' : 'text-white/40 hover:text-white'
                    }`}
                 >
                    {s.name}
                 </button>
              ))}
           </div>
        </div>

        {/* Body mass info in the bottom-left */}
        <div className="absolute bottom-12 left-12 z-10 pointer-events-none hidden sm:block">
          <div className="flex items-center space-x-6">
             {activeScenario.bodies.map((b, i) => {
                const paletteColors = PALETTES[activePalette].colors;
                const color = paletteColors[i % paletteColors.length];
                return (
                  <div key={i} className="flex items-center space-x-2">
                     <div className="w-1.5 h-1.5 rounded-full transition-colors duration-500" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}99` }}></div>
                     <span className="text-[10px] font-mono text-white/40">M{i+1}: {b.mass.toFixed(2)}</span>
                  </div>
                )
             })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 border-t border-white/5 flex items-center justify-between px-8 text-[9px] uppercase tracking-widest text-white/20 relative z-10 bg-[#0A0A0C]/40 backdrop-blur-sm">
        <span>Simulation Realtime v1.0.4</span>
        <div className="flex space-x-8">
          <span>RK4 Integrator</span>
          <span>dt={activeScenario.dt}</span>
        </div>
      </footer>
    </div>
  );
}
