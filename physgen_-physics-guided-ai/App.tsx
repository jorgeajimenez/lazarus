import React, { useState, useRef, useEffect } from 'react';
import { Activity, Zap, Search, Play, Square, Camera, FlaskConical, RefreshCw, Wand2, Microscope, Trash2, Plus, Box, Circle, Triangle, Cylinder, Hexagon, Layers, Gauge, AlertTriangle, X, Download, MousePointer2, Palette, RotateCcw, Bug } from 'lucide-react';
import PhysicsScene from './components/PhysicsScene';
import { ScientificMaterial, PhysicsAnalysis, BodyType, SimStats, SpawnMode, ParticleShape } from './types';
import { generateImageFromPhysics, generateBasicImage, analyzePhysicsFromPrompt } from './services/geminiService';

// --- UNIVERSAL PRESETS (Consumer, Research, Industrial) ---
const MATERIAL_PRESETS: Record<string, ScientificMaterial> = {
    DEFAULT: { id: 'DEFAULT', name: 'Standard Matter', youngsModulus: 50, viscosity: 0.5, yieldStress: 0.5, density: 1000, color: '#38bdf8' },
    JELLO: { id: 'JELLO', name: 'Bouncy Jello (Food)', youngsModulus: 5, viscosity: 0.1, yieldStress: 0.1, density: 900, color: '#facc15' },
    CHROME: { id: 'CHROME', name: 'Liquid Chrome (Design)', youngsModulus: 80, viscosity: 0.8, yieldStress: 0.0, density: 7000, color: '#e2e8f0' },
    SILK: { id: 'SILK', name: 'Digital Silk (Fashion)', youngsModulus: 20, viscosity: 0.0, yieldStress: 0.0, density: 500, color: '#f472b6' },
    AEROGEL: { id: 'AEROGEL', name: 'Aerogel (Science)', youngsModulus: 10, viscosity: 0.9, yieldStress: 0.8, density: 100, color: '#22d3ee' },
    CONCRETE: { id: 'CONCRETE', name: 'Concrete (Industrial)', youngsModulus: 95, viscosity: 1.0, yieldStress: 1.0, density: 2400, color: '#94a3b8' },
};

const StepIndicator = ({ step, label, isActive, isDone }: { step: string, label: string, isActive: boolean, isDone: boolean }) => (
    <div className={`flex items-center gap-2 px-3 py-1 rounded transition-all ${isActive ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-800 shadow-[0_0_15px_rgba(6,182,212,0.3)]' : isDone ? 'text-green-500' : 'text-slate-600'}`}>
        <span className="font-mono font-bold">{step}</span>
        <span className="text-[10px] tracking-widest font-bold">{label}</span>
    </div>
);

const App: React.FC = () => {
    const [apiKeyReady, setApiKeyReady] = useState(false);
    const [prompt, setPrompt] = useState("");
    const [styleVibe, setStyleVibe] = useState(""); // User artistic direction
    const [analysis, setAnalysis] = useState<PhysicsAnalysis | null>(null);
    const [spawnMode, setSpawnMode] = useState<SpawnMode>(SpawnMode.PILE);
    const [isSimulating, setIsSimulating] = useState(false);
    const [capturedState, setCapturedState] = useState<string | null>(null);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [basicImage, setBasicImage] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isRendering, setIsRendering] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'SCIENTIFIC' | 'FREESTYLE'>('SCIENTIFIC');
    const [particleDensity, setParticleDensity] = useState(5);
    const [simStats, setSimStats] = useState<SimStats>({ activeParticles: 0, systemEnergy: 0, systemSnap: 0 });
    const [particleShape, setParticleShape] = useState<ParticleShape>(ParticleShape.POINT);

    const [materialParams, setMaterialParams] = useState<ScientificMaterial>(MATERIAL_PRESETS.DEFAULT);
    const sceneRef = useRef<any>(null);

    useEffect(() => {
        // @ts-ignore
        if (window.aistudio && window.aistudio.hasSelectedApiKey) {
            // @ts-ignore 
            window.aistudio.hasSelectedApiKey().then(setApiKeyReady);
        } else if (process.env.API_KEY) {
            setApiKeyReady(true);
        }
    }, []);

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        setErrorMsg(null);
        try {
            const result = await analyzePhysicsFromPrompt(prompt);
            setAnalysis(result);
            // Don't override color if user already picked one, unless it's the first run
            setMaterialParams(prev => ({ ...result.material, color: prev.id === 'DEFAULT' ? result.material.color : prev.color }));
            setSpawnMode(result.spawnMode);
            if (sceneRef.current) {
                sceneRef.current.resetScene();
                setTimeout(() => sceneRef.current.spawnBatch(result.estimatedCounts), 100);
            }
        } catch (e) {
            console.error(e);
            setErrorMsg("Analysis failed.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleRender = async () => {
        if (!analysis || !capturedState) return;
        setIsRendering(true);
        setErrorMsg(null);
        try {
            const currentAnalysis = { ...analysis, material: materialParams, spawnMode: spawnMode };
            const [sci, basic] = await Promise.all([
                generateImageFromPhysics(prompt, capturedState, currentAnalysis, simStats, styleVibe),
                generateBasicImage(prompt, currentAnalysis, styleVibe)
            ]);
            setGeneratedImage(sci);
            setBasicImage(basic);
        } catch (e: any) {
            setErrorMsg(e.message || "Generation failed.");
        } finally {
            setIsRendering(false);
        }
    };

    const downloadImage = () => {
        const img = viewMode === 'SCIENTIFIC' ? generatedImage : basicImage;
        if (!img) return;
        const link = document.createElement('a');
        link.href = img;
        link.download = `snaplock-${Date.now()}.png`;
        link.click();
    };

    const handlePresetSelect = (key: string) => {
        const p = MATERIAL_PRESETS[key];
        setMaterialParams(prev => ({ ...prev, ...p, color: p.color }));
    };

    const handleReset = () => {
        if (sceneRef.current) sceneRef.current.resetScene();
        setIsSimulating(false);
        setCapturedState(null);
        setGeneratedImage(null);
        setBasicImage(null);
        setErrorMsg(null);
        setAnalysis(null);
        setSimStats({ activeParticles: 0, systemEnergy: 0, systemSnap: 0 });
    };

    const handleReplay = () => {
        if (sceneRef.current) {
            sceneRef.current.triggerReplay();
            setIsSimulating(true);
        }
    };

    const handleCaptureResult = (dataUrl: string) => {
        setCapturedState(dataUrl);
        setIsSimulating(false);
    };

    const handleBugReport = () => {
        const payload = {
            prompt,
            materialParams,
            simStats,
            spawnMode,
            particleDensity,
            viewMode,
            particleShape,
            errorMsg,
            timestamp: new Date().toISOString()
        };

        fetch('http://localhost:8000/log-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(res => res.json())
            .then(data => {
                alert("🐛 Bug Report Sent to Logger!");
                console.log("Bug Report Success:", data);
            })
            .catch(err => {
                alert("❌ Failed to send report. Is logger.py running on port 8000?");
                console.error("Bug Report Error:", err);
            });
    };

    if (!apiKeyReady) return <div className="h-screen flex items-center justify-center bg-slate-950 text-cyan-500 font-mono">AUTHENTICATE API KEY</div>;

    return (
        <div className="h-screen w-full flex flex-col bg-slate-950 text-slate-300 font-sans selection:bg-cyan-500/30">

            {/* --- Header --- */}
            <div className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex items-center px-6 justify-between shrink-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded flex items-center justify-center text-white font-bold shadow-lg shadow-cyan-500/20">
                        <Layers size={24} />
                    </div>
                    <div>
                        <h1 className="font-bold text-2xl text-white tracking-widest uppercase leading-none">SnapLock</h1>
                        <span className="text-cyan-500 text-[10px] tracking-widest opacity-70">PHYSICS-GUIDED CREATIVITY</span>
                    </div>
                </div>
                <div className="flex gap-4 items-center">
                    <button
                        onClick={handleBugReport}
                        className="text-orange-500 hover:text-orange-400 hover:bg-orange-900/20 p-2 rounded transition-colors flex items-center gap-2 text-[10px] font-bold tracking-wider border border-transparent hover:border-orange-500/30"
                        title="Report Bug / Save State"
                    >
                        <Bug size={14} /> BUG REPORT
                    </button>
                    <div className="w-[1px] h-8 bg-slate-800 mx-2"></div>
                    <StepIndicator step="01" label="SETUP" isActive={!analysis} isDone={!!analysis} />
                    <StepIndicator step="02" label="SIMULATION" isActive={!!analysis && !capturedState} isDone={!!capturedState} />
                    <StepIndicator step="03" label="SNAP STUDIO" isActive={!!capturedState} isDone={!!generatedImage} />
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden relative">

                {/* --- Left Lab Panel --- */}
                <div className="w-[400px] bg-slate-900/30 border-r border-slate-800 flex flex-col overflow-y-auto p-4 gap-6 shrink-0 custom-scrollbar z-0">

                    {/* 1. Prompt & Style */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-cyan-400 flex items-center gap-2 tracking-wider">
                            <Zap size={14} /> 1. DESCRIBE SCENE
                        </label>
                        <textarea
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            placeholder="E.g., 'A futuristic sneaker made of liquid gold' or 'An exploding watermelon'"
                            className="w-full bg-black/40 border border-slate-700 rounded p-3 text-sm font-mono focus:border-cyan-500 outline-none resize-none h-20 text-white placeholder:text-slate-600"
                        />
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={styleVibe}
                                onChange={e => setStyleVibe(e.target.value)}
                                placeholder="Style/Vibe (Optional, e.g. Cyberpunk, Vogue)"
                                className="flex-1 bg-black/40 border border-slate-700 rounded px-3 py-2 text-xs font-mono focus:border-cyan-500 outline-none text-white"
                            />
                        </div>
                        <button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing}
                            className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-cyan-500 rounded flex items-center justify-center gap-2 text-xs font-bold tracking-wider transition-all text-white hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]"
                        >
                            {isAnalyzing ? <RefreshCw className="animate-spin" size={14} /> : <Search size={14} />}
                            {isAnalyzing ? 'ANALYZING...' : 'SETUP PHYSICS'}
                        </button>
                    </div>

                    {/* 2. Physics & Material */}
                    <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4 space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                            <span className="text-xs font-bold text-purple-400 flex items-center gap-2 tracking-wider"><FlaskConical size={14} /> PHYSICS LAB</span>
                            <select
                                onChange={(e) => handlePresetSelect(e.target.value)}
                                className="bg-slate-900 text-[10px] border border-slate-700 rounded px-2 py-1 text-slate-300 outline-none"
                            >
                                <option value="DEFAULT">Presets...</option>
                                {Object.entries(MATERIAL_PRESETS).map(([k, v]) => (
                                    <option key={k} value={k}>{v.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-4">
                            {/* Color Picker */}
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] uppercase text-slate-400 flex items-center gap-2">
                                    <Palette size={12} /> Material Color
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-slate-500">{materialParams.color}</span>
                                    <input
                                        type="color"
                                        value={materialParams.color}
                                        onChange={(e) => setMaterialParams(p => ({ ...p, color: e.target.value }))}
                                        className="w-6 h-6 rounded cursor-pointer border-none bg-transparent"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] uppercase text-slate-400">
                                    <span>Stiffness (Young's)</span>
                                    <span className="font-mono text-cyan-300">{materialParams.youngsModulus.toFixed(0)}</span>
                                </div>
                                <input
                                    type="range" min="1" max="100" step="1"
                                    value={materialParams.youngsModulus}
                                    onChange={(e) => setMaterialParams(p => ({ ...p, youngsModulus: parseFloat(e.target.value) }))}
                                    className="w-full accent-cyan-500"
                                />
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] uppercase text-slate-400">
                                    <span>Viscosity (Flow)</span>
                                    <span className="font-mono text-cyan-300">{materialParams.viscosity.toFixed(2)}</span>
                                </div>
                                <input
                                    type="range" min="0" max="1" step="0.01"
                                    value={materialParams.viscosity}
                                    onChange={(e) => setMaterialParams(p => ({ ...p, viscosity: parseFloat(e.target.value) }))}
                                    className="w-full accent-cyan-500"
                                />
                            </div>

                            {/* Particle Element Selector */}
                            <div className="space-y-1 pt-2 border-t border-slate-800">
                                <div className="flex justify-between text-[10px] uppercase text-slate-400">
                                    <span>Particle Element</span>
                                </div>
                                <select
                                    value={particleShape}
                                    onChange={(e) => setParticleShape(e.target.value as ParticleShape)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-cyan-500"
                                >
                                    <option value={ParticleShape.POINT}>Dust (Points)</option>
                                    <option value={ParticleShape.SPHERE}>Marbles (Spheres)</option>
                                    <option value={ParticleShape.BOX}>Blocks (Cubes)</option>
                                    <option value={ParticleShape.CYLINDER}>Coins (Cylinders)</option>
                                    <option value={ParticleShape.TRAPEZOID}>Trapezoids</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 3. Assets */}
                    <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                            <span className="text-xs font-bold text-green-400 flex items-center gap-2 tracking-wider"><Plus size={14} /> ADD MASS</span>
                            <button onClick={handleReset} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 hover:bg-red-900/20 px-2 py-0.5 rounded transition-colors"><Trash2 size={12} /> CLEAR</button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { type: BodyType.BOX, Icon: Box }, { type: BodyType.SPHERE, Icon: Circle },
                                { type: BodyType.CONE, Icon: Triangle }, { type: BodyType.CYLINDER, Icon: Cylinder },
                                { type: BodyType.PYRAMID, Icon: Triangle, rotate: true },
                                { type: BodyType.TORUS, Icon: Circle, stroke: 4 },
                                { type: BodyType.CAPSULE, Icon: Hexagon },
                            ].map(({ type, Icon, rotate, stroke }) => (
                                <button key={type} onClick={() => sceneRef.current?.addObject(type)} className="aspect-square bg-slate-900 border border-slate-700 hover:border-cyan-500 hover:text-cyan-400 rounded flex items-center justify-center text-slate-500 transition-all hover:scale-105">
                                    <Icon size={16} strokeWidth={stroke || 2} className={rotate ? 'rotate-45' : ''} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 4. Stats */}
                    <div className="bg-slate-950 border border-slate-800 rounded p-4 font-mono text-[10px] text-slate-400 space-y-2">
                        <div className="flex items-center gap-2 text-cyan-500 pb-1 border-b border-slate-800">
                            <Gauge size={12} /> LIVE STATS
                        </div>
                        <div className="grid grid-cols-2 gap-y-2">
                            <div>SNAP: <span className="text-yellow-400 font-bold">{simStats.systemSnap.toFixed(1)}</span></div>
                            <div>ENERGY: <span className="text-white font-bold">{simStats.systemEnergy.toFixed(0)}</span></div>
                            <div>COUNT: <span className="text-slate-300">{simStats.activeParticles}</span></div>
                        </div>
                    </div>
                </div>

                {/* --- Main Viewport --- */}
                <div className="flex-1 relative bg-black flex flex-col z-0">

                    {/* 3D Canvas */}
                    <div className="flex-1 relative group cursor-crosshair">
                        <div className="absolute top-4 left-4 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 p-2 rounded text-[10px] text-white flex items-center gap-2 border border-white/10">
                            <MousePointer2 size={12} /> INTERACTIVE: CLICK & DRAG TO DISRUPT PHYSICS
                        </div>

                        <PhysicsScene
                            ref={sceneRef}
                            material={materialParams}
                            isSimulating={isSimulating}
                            onCapture={handleCaptureResult}
                            spawnMode={spawnMode}
                            particleDensity={particleDensity}
                            onStatsUpdate={setSimStats}
                            particleShape={particleShape}
                        />

                        {/* Floating Action Bar */}
                        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-4 pointer-events-auto z-10">
                            {simStats.activeParticles > 0 && (
                                <button
                                    onClick={handleReplay}
                                    className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center shadow-lg border border-slate-600 transition-all hover:scale-105"
                                    title="Replay Simulation"
                                >
                                    <RotateCcw size={20} />
                                </button>
                            )}

                            {!isSimulating ? (
                                <button
                                    onClick={() => setIsSimulating(true)}
                                    className={`h-12 px-8 rounded-full font-bold flex items-center gap-3 shadow-lg hover:scale-105 transition-all text-sm tracking-widest bg-cyan-600 hover:bg-cyan-500 text-white`}
                                >
                                    <Play size={18} fill="currentColor" />
                                    {simStats.activeParticles > 0 ? 'RESUME SIM' : 'START SIM'}
                                </button>
                            ) : (
                                <button onClick={() => sceneRef.current?.triggerCapture()} className="h-12 px-8 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-3 shadow-lg animate-pulse text-sm tracking-widest border border-red-400">
                                    <Camera size={18} /> SNAP REALITY
                                </button>
                            )}
                        </div>
                    </div>

                    {/* --- Step 3: SNAP STUDIO MODAL --- */}
                    {capturedState && (
                        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl z-50 flex items-center justify-center p-8 animate-in fade-in duration-300">
                            <div className="w-full max-w-7xl h-full flex gap-8">

                                {/* Left: Controls */}
                                <div className="w-[320px] flex flex-col gap-6 pt-4">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-1">
                                            <Activity className="text-cyan-500" /> SNAP STUDIO
                                        </h2>
                                        <p className="text-slate-400 text-xs">
                                            Transform physical geometry into art.
                                        </p>
                                    </div>

                                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-2">
                                        <div className="aspect-square bg-black relative rounded overflow-hidden border border-slate-800">
                                            <img src={capturedState} alt="Snap" className="w-full h-full object-contain opacity-70" />
                                            <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-[9px] font-mono border border-white/10 text-cyan-400">SEMANTIC INPUT</div>
                                        </div>
                                    </div>

                                    <div className="flex-1 flex flex-col justify-end gap-3">
                                        <button
                                            onClick={handleRender}
                                            disabled={isRendering}
                                            className="w-full h-14 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-lg rounded-lg flex items-center justify-center gap-3 tracking-widest shadow-lg shadow-cyan-900/50 disabled:opacity-50 transition-all"
                                        >
                                            {isRendering ? <RefreshCw className="animate-spin" /> : <Wand2 />}
                                            {isRendering ? 'GENERATING...' : 'GENERATE'}
                                        </button>

                                        <button
                                            onClick={() => { setCapturedState(null); setIsSimulating(false); }}
                                            className="w-full h-10 border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold rounded flex items-center justify-center gap-2 transition-all"
                                        >
                                            <X size={14} /> CANCEL
                                        </button>
                                    </div>
                                </div>

                                {/* Right: Gallery Output */}
                                <div className="flex-1 bg-black border border-slate-800 rounded-2xl relative flex items-center justify-center overflow-hidden shadow-2xl bg-grid-slate-900/[0.1]">
                                    {errorMsg ? (
                                        <div className="text-red-400 text-center p-8 bg-red-950/30 rounded border border-red-900/50">
                                            <AlertTriangle className="mx-auto mb-4" size={48} />
                                            <h3 className="font-bold mb-2">Generation Failed</h3>
                                            <p className="text-sm font-mono">{errorMsg}</p>
                                        </div>
                                    ) : generatedImage ? (
                                        <div className="relative w-full h-full group">
                                            <img src={viewMode === 'SCIENTIFIC' ? generatedImage : basicImage!} className="w-full h-full object-contain" />

                                            {/* Result Toolbar */}
                                            <div className="absolute top-6 right-6 flex gap-2">
                                                <div className="bg-black/80 backdrop-blur rounded-lg border border-slate-700 p-1 flex gap-1">
                                                    <button onClick={() => setViewMode('SCIENTIFIC')} className={`px-4 py-2 rounded-md font-bold text-xs transition-all ${viewMode === 'SCIENTIFIC' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                                                        SNAPLOCK
                                                    </button>
                                                    <button onClick={() => setViewMode('FREESTYLE')} className={`px-4 py-2 rounded-md font-bold text-xs transition-all ${viewMode === 'FREESTYLE' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                                                        BASELINE
                                                    </button>
                                                </div>
                                                <button onClick={downloadImage} className="bg-white text-black hover:bg-slate-200 px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-lg transition-colors">
                                                    <Download size={14} /> SAVE
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-6 opacity-20 animate-pulse">
                                            <Activity size={80} />
                                            <span className="text-2xl font-mono tracking-[0.5em] font-light">READY TO SNAP</span>
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default App;