
import React, { useState, useEffect, useRef } from 'react';
import { analyzeChaos, analyzeFolderStructure, compareNodes } from './services/geminiService';
import { ChaosEntry, ChaosAnalysis, FolderNode, FileMetadata, CompareResult, Bookmark } from './types';
import EntropyChart from './components/EntropyChart';
import FileTree from './components/FileTree';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dump' | 'crawler' | 'ledger'>('crawler');
  const [entries, setEntries] = useState<ChaosEntry[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState<ChaosAnalysis | null>(null);
  
  // Crawler & Persistent State
  const [rootNode, setRootNode] = useState<FolderNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<FolderNode | FileMetadata | null>(null);
  const [nodeAnalysis, setNodeAnalysis] = useState<{ projectType: string; entropy: number; insights: string[]; rescuePlan: string } | null>(null);
  const [compareTargets, setCompareTargets] = useState<{ a: FolderNode | null; b: FolderNode | null }>({ a: null, b: null });
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  
  // Input Ref for Directory Selection
  const directoryInputRef = useRef<HTMLInputElement>(null);

  // Bookmarking System
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    const saved = localStorage.getItem('chaos_bookmarks');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentComment, setCurrentComment] = useState('');

  useEffect(() => {
    localStorage.setItem('chaos_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  const handleCrawlTrigger = () => {
    if (directoryInputRef.current) {
      directoryInputRef.current.click();
    }
  };

  const handleDirectoryChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    try {
      // Reconstruct tree from FileList webkitRelativePath
      const buildTree = (fileList: FileList): FolderNode => {
        const rootName = fileList[0].webkitRelativePath.split('/')[0];
        const root: FolderNode = {
          id: crypto.randomUUID(),
          name: rootName,
          path: rootName,
          children: []
        };

        const findOrUpdateFolder = (current: FolderNode, pathParts: string[]): FolderNode => {
          let tempNode = current;
          for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i];
            let existing = tempNode.children.find(c => 'children' in c && c.name === part) as FolderNode;
            
            if (!existing) {
              existing = {
                id: crypto.randomUUID(),
                name: part,
                path: pathParts.slice(0, i + 1).join('/'),
                children: []
              };
              tempNode.children.push(existing);
            }
            tempNode = existing;
          }
          return tempNode;
        };

        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];
          const fullPath = file.webkitRelativePath;
          const parts = fullPath.split('/');
          const fileName = parts.pop()!;
          const dirParts = parts.slice(1); // Exclude root name

          const targetFolder = dirParts.length > 0 ? findOrUpdateFolder(root, dirParts) : root;
          
          targetFolder.children.push({
            name: fileName,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            path: fullPath
          });
        }
        return root;
      };

      const root = buildTree(files);
      setRootNode(root);
      setNodeAnalysis(null);
      setSelectedNode(null);
    } catch (err) {
      console.error("Crawl failed:", err);
    } finally {
      setIsProcessing(false);
      // Reset input value so the same folder can be picked again if needed
      if (directoryInputRef.current) directoryInputRef.current.value = '';
    }
  };

  const analyzeNode = async (node: FolderNode) => {
    setIsProcessing(true);
    try {
      const summary = node.children.map(c => c.name).slice(0, 50).join(', ');
      const result = await analyzeFolderStructure(`Folder: ${node.name}\nPath: ${node.path}\nFiles/Subfolders: ${summary}`);
      setNodeAnalysis(result);
      
      setRootNode(prev => {
        if (!prev) return null;
        const update = (n: FolderNode): FolderNode => {
          if (n.id === node.id) return { ...n, projectType: result.projectType, entropy: result.entropy, rescuePlan: result.rescuePlan };
          return { ...n, children: n.children.map(c => 'children' in c ? update(c) : c) };
        };
        return update(prev);
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompare = async () => {
    if (!compareTargets.a || !compareTargets.b) return;
    setIsProcessing(true);
    try {
      const result = await compareNodes(
        JSON.stringify({ name: compareTargets.a.name, files: compareTargets.a.children.map(c => c.name) }),
        JSON.stringify({ name: compareTargets.b.name, files: compareTargets.b.children.map(c => c.name) })
      );
      setCompareResult(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const addBookmark = () => {
    if (!selectedNode) return;
    const newBookmark: Bookmark = {
      id: crypto.randomUUID(),
      path: selectedNode.path,
      driveName: rootNode?.name || 'Unknown Volume',
      comment: currentComment,
      timestamp: Date.now(),
      tags: [],
      nodeName: selectedNode.name
    };
    setBookmarks(prev => [newBookmark, ...prev]);
    setCurrentComment('');
  };

  const removeBookmark = (id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
  };

  const handleChaosSubmit = async () => {
    if (!currentInput.trim()) return;
    const newId = crypto.randomUUID();
    const newEntry: ChaosEntry = { id: newId, timestamp: Date.now(), content: currentInput, status: 'processing' };
    setEntries(prev => [newEntry, ...prev]);
    setIsProcessing(true);
    setCurrentInput('');
    try {
      const analysis = await analyzeChaos(newEntry.content);
      setEntries(prev => prev.map(e => e.id === newId ? { ...e, analysis, status: 'completed' } : e));
      setActiveAnalysis(analysis);
    } catch (err) {
      setEntries(prev => prev.map(e => e.id === newId ? { ...e, status: 'error' } : e));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200">
      {/* Hidden input for directory selection */}
      <input
        type="file"
        ref={directoryInputRef}
        onChange={handleDirectoryChange}
        style={{ display: 'none' }}
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
      />

      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 chaos-gradient rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M21 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2"/><path d="M5 21V3"/><path d="M19 21V3"/></svg>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter uppercase italic">ChaosControl</h1>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest leading-none">Neural Rescue Command</p>
          </div>
        </div>
        <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5 overflow-hidden">
          <button 
            onClick={() => setActiveTab('crawler')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${activeTab === 'crawler' ? 'bg-indigo-500 text-white shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Digital Archeology
          </button>
          <button 
            onClick={() => setActiveTab('ledger')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${activeTab === 'ledger' ? 'bg-indigo-500 text-white shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Rescue Ledger
          </button>
          <button 
            onClick={() => setActiveTab('dump')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${activeTab === 'dump' ? 'bg-indigo-500 text-white shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Mission Logs
          </button>
        </div>
      </nav>

      <main className="pt-24 pb-12 px-4 md:px-8 max-w-screen-2xl mx-auto">
        {activeTab === 'crawler' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-160px)]">
            {/* Explorer Column */}
            <div className="lg:col-span-4 glass rounded-3xl overflow-hidden flex flex-col border border-white/5">
              <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-900/40">
                <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12H3m18-6H3m18 12H3"/></svg>
                  Physical Volume Index
                </h2>
                <button 
                  onClick={handleCrawlTrigger}
                  className="text-[10px] bg-indigo-500 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-400 transition-all font-black uppercase shadow-lg shadow-indigo-500/20 active:scale-95"
                >
                  Mount Drive
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-950/20">
                {rootNode ? (
                  <FileTree node={rootNode} onSelect={setSelectedNode} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-4">
                    <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-700 animate-pulse">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><line x1="6" y1="6" x2="6" y2="6"/><line x1="6" y1="18" x2="6" y2="18"/></svg>
                    </div>
                    <div>
                      <h3 className="text-slate-400 font-bold uppercase text-xs tracking-widest">No Active Mount</h3>
                      <p className="text-slate-600 text-[10px] mt-2 max-w-[200px] mx-auto uppercase font-black">Link drive to begin structural reconstruction protocol.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Analysis Column */}
            <div className="lg:col-span-8 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
              {selectedNode ? (
                <div className="space-y-6 animate-in fade-in duration-500 pb-12">
                  {/* Node Header & Tagging */}
                  <section className="glass p-8 rounded-[2.5rem] relative overflow-hidden border border-white/10 shadow-2xl">
                    <div className="absolute top-0 right-0 p-8 flex gap-3 z-10">
                       <button 
                        onClick={() => setCompareTargets(prev => ({ ...prev, a: selectedNode as FolderNode }))}
                        className="px-4 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded-xl text-[10px] font-black uppercase hover:bg-amber-500/20 transition-all"
                       >
                         Mark A
                       </button>
                       <button 
                        onClick={() => setCompareTargets(prev => ({ ...prev, b: selectedNode as FolderNode }))}
                        className="px-4 py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-500/20 transition-all"
                       >
                         Mark B
                       </button>
                    </div>
                    
                    <div className="flex items-start gap-6">
                      <div className="w-16 h-16 rounded-[1.25rem] chaos-gradient flex items-center justify-center text-white shadow-2xl shadow-indigo-500/20">
                         {'children' in selectedNode ? (
                           <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                         ) : (
                           <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                         )}
                      </div>
                      <div className="pt-1 pr-40">
                        <h2 className="text-3xl font-black text-white tracking-tight">{selectedNode.name}</h2>
                        <p className="text-xs text-slate-500 font-mono mt-1 opacity-70 truncate max-w-lg">{selectedNode.path || 'Root Node'}</p>
                      </div>
                    </div>

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        {'children' in selectedNode && (
                          <button 
                            onClick={() => analyzeNode(selectedNode as FolderNode)}
                            disabled={isProcessing}
                            className="w-full px-8 py-3 bg-white text-slate-950 rounded-2xl text-xs font-black uppercase tracking-[0.15em] hover:bg-indigo-400 hover:text-white transition-all shadow-xl disabled:opacity-50"
                          >
                            {isProcessing ? 'Synthesizing...' : 'Neural Reconstruction'}
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            placeholder="Add comment to ledger..."
                            className="flex-1 bg-slate-900/80 border border-white/5 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                            value={currentComment}
                            onChange={(e) => setCurrentComment(e.target.value)}
                          />
                          <button 
                            onClick={addBookmark}
                            className="px-4 py-2 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-500/30"
                          >
                            Tag
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Node Analysis Results */}
                  {nodeAnalysis && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
                      <div className="glass p-8 rounded-[2rem] border border-white/5 shadow-xl flex flex-col justify-between">
                        <div>
                          <h3 className="text-[10px] font-black uppercase text-indigo-400 mb-6 tracking-[0.2em]">Heuristic Signature</h3>
                          <span className="text-2xl font-black text-white leading-tight block mb-4">{nodeAnalysis.projectType}</span>
                        </div>
                        <div className="p-4 bg-slate-900/60 rounded-2xl border border-white/5">
                          <div className="flex justify-between items-end mb-2">
                            <span className="text-[10px] uppercase font-bold text-slate-500">System Entropy</span>
                            <span className="text-lg font-black font-mono text-indigo-400">{nodeAnalysis.entropy}%</span>
                          </div>
                          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-[1500ms] ${nodeAnalysis.entropy > 70 ? 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]' : 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]'}`} 
                              style={{ width: `${nodeAnalysis.entropy}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="glass p-8 rounded-[2rem] border border-white/5 shadow-xl">
                        <h3 className="text-[10px] font-black uppercase text-slate-500 mb-6 tracking-[0.2em]">Structural Insights</h3>
                        <ul className="space-y-3 overflow-y-auto max-h-48 custom-scrollbar">
                          {nodeAnalysis.insights.map((insight, idx) => (
                            <li key={idx} className="flex items-start gap-4 text-sm text-slate-300 leading-relaxed">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0"></span>
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="md:col-span-2 glass p-8 rounded-[2.5rem] border border-indigo-500/20 bg-indigo-500/5 shadow-2xl relative overflow-hidden">
                         <div className="absolute top-0 right-0 p-8 opacity-10">
                           <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
                         </div>
                         <h3 className="text-[11px] font-black uppercase text-indigo-400 mb-4 tracking-[0.3em] flex items-center gap-2">
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m12 14 4-4-4-4"/><path d="M3 3v18h18"/></svg>
                           Rescue Protocol v1.4
                         </h3>
                         <div className="prose prose-invert prose-sm max-w-none">
                            <p className="text-base text-indigo-100 font-medium leading-relaxed whitespace-pre-wrap italic">
                              {nodeAnalysis.rescuePlan}
                            </p>
                         </div>
                      </div>
                    </div>
                  )}

                  {/* Comparison Section */}
                  {(compareTargets.a || compareTargets.b) && (
                    <section className="glass p-8 rounded-[2.5rem] border border-amber-500/20 bg-slate-900/40 relative">
                      <h3 className="text-xs font-black uppercase text-amber-500 mb-8 tracking-[0.3em] flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 21v-4"/><path d="m9 18 3 3 3-3"/></svg>
                        Cross-Drive Neural Matcher
                      </h3>
                      <div className="grid grid-cols-2 gap-6 mb-8">
                        <div className={`p-6 rounded-[1.5rem] border transition-all ${compareTargets.a ? 'bg-amber-500/5 border-amber-500/30' : 'border-dashed border-slate-700 opacity-40'}`}>
                           <p className="text-[10px] uppercase font-black text-amber-600 tracking-widest italic mb-2">Base Node (A)</p>
                          <p className="text-lg font-bold truncate text-white">{compareTargets.a?.name || 'Awaiting...'}</p>
                        </div>
                        <div className={`p-6 rounded-[1.5rem] border transition-all ${compareTargets.b ? 'bg-emerald-500/5 border-emerald-500/30' : 'border-dashed border-slate-700 opacity-40'}`}>
                           <p className="text-[10px] uppercase font-black text-emerald-600 tracking-widest italic mb-2">Candidate (B)</p>
                          <p className="text-lg font-bold truncate text-white">{compareTargets.b?.name || 'Awaiting...'}</p>
                        </div>
                      </div>
                      <button 
                        onClick={handleCompare}
                        disabled={!compareTargets.a || !compareTargets.b || isProcessing}
                        className="w-full py-5 bg-amber-500 text-slate-950 rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-amber-400 transition-all disabled:opacity-30 shadow-2xl active:scale-[0.98]"
                      >
                        {isProcessing ? 'Synchronizing...' : 'Execute Logical Match'}
                      </button>

                      {compareResult && (
                        <div className="mt-8 space-y-6 animate-in fade-in zoom-in-95">
                           <div className="p-6 bg-slate-950/80 rounded-[2rem] border border-white/10 shadow-inner">
                              <div className="flex justify-between items-center mb-4">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Similarity Match Index</h4>
                                <span className="text-4xl font-black text-amber-500 font-mono">{compareResult.matchScore}%</span>
                              </div>
                              <p className="text-lg text-slate-300 font-medium leading-snug">"{compareResult.diffSummary}"</p>
                           </div>
                           <div className="p-8 bg-indigo-600 text-white rounded-[2rem] shadow-2xl relative overflow-hidden">
                             <p className="text-[11px] font-black uppercase tracking-[0.4em] mb-4 opacity-70">Neural Recommendation</p>
                             <p className="text-2xl font-black leading-tight italic">{compareResult.recommendation}</p>
                           </div>
                        </div>
                      )}
                    </section>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center glass rounded-[3rem] border border-dashed border-white/5 min-h-[500px] opacity-40">
                  <div className="w-24 h-24 text-slate-800 mb-8 animate-[spin_30s_linear_infinite]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/><circle cx="12" cy="12" r="6"/></svg>
                  </div>
                  <h3 className="text-slate-500 uppercase tracking-[0.5em] text-sm font-black italic">Select Archeological Node</h3>
                  <p className="text-slate-700 text-[10px] mt-4 uppercase font-black tracking-[0.2em]">Map drive to identify good bits from sabotage</p>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'ledger' ? (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
             <header className="flex justify-between items-end">
                <div>
                   <h2 className="text-4xl font-black text-white tracking-tighter italic uppercase">Rescue Ledger</h2>
                   <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">Cross-Drive Progress Monitor</p>
                </div>
                <button 
                  onClick={() => {
                    const data = JSON.stringify(bookmarks, null, 2);
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `chaos-ledger-${Date.now()}.json`;
                    a.click();
                  }}
                  className="px-4 py-2 glass text-[10px] font-black uppercase text-slate-400 hover:text-white border border-white/5 rounded-xl flex items-center gap-2"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Export Ledger
                </button>
             </header>

             <div className="grid grid-cols-1 gap-4">
                {bookmarks.map(b => (
                  <div key={b.id} className="glass p-6 rounded-3xl border border-white/5 relative group hover:border-indigo-500/30 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                         </div>
                         <div>
                            <h4 className="text-lg font-black text-white tracking-tight leading-none">{b.nodeName}</h4>
                            <p className="text-[10px] text-slate-500 font-mono mt-1">VOL: {b.driveName} • {new Date(b.timestamp).toLocaleString()}</p>
                         </div>
                      </div>
                      <button 
                        onClick={() => removeBookmark(b.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 rounded-lg transition-all"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>
                    <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/5">
                       <p className="text-sm text-slate-300 italic">"{b.comment || 'No mission notes recorded.'}"</p>
                    </div>
                    <p className="text-[10px] text-slate-600 font-mono mt-3 truncate opacity-50">{b.path}</p>
                  </div>
                ))}
                {bookmarks.length === 0 && (
                  <div className="p-20 text-center glass rounded-3xl border border-dashed border-white/10">
                    <p className="text-slate-600 font-black uppercase text-xs tracking-widest">Ledger empty. Tag items in Digital Archeology to track progress.</p>
                  </div>
                )}
             </div>
          </div>
        ) : (
          /* Mission Logs Tab (formerly Brain Dump) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl mx-auto">
            <div className="lg:col-span-12 space-y-6">
              <section className="glass p-10 rounded-[3rem] border border-white/10 shadow-2xl relative overflow-hidden">
                <h2 className="text-sm font-black text-indigo-400 mb-6 uppercase tracking-[0.4em] italic flex items-center gap-3">
                   <span className="w-8 h-[2px] bg-indigo-500"></span>
                   Tactical Intelligence Feed
                </h2>
                <textarea
                  className="w-full h-64 bg-slate-900/40 border border-slate-800 rounded-[2rem] p-8 text-lg text-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all resize-none placeholder:text-slate-700 font-medium italic"
                  placeholder="Describe the state of the drive currently mounted... specific sabotage signatures to look for..."
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  disabled={isProcessing}
                />
                <div className="mt-8 flex justify-end">
                  <button
                    onClick={handleChaosSubmit}
                    disabled={isProcessing || !currentInput.trim()}
                    className="px-12 py-5 rounded-2xl font-black uppercase tracking-[0.3em] transition-all chaos-gradient text-white shadow-2xl shadow-indigo-500/40 hover:scale-[1.02] active:scale-95 disabled:opacity-30"
                  >
                    {isProcessing ? 'Synchronizing...' : 'Update Context'}
                  </button>
                </div>
              </section>

              {activeAnalysis && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-10 duration-1000">
                  <EntropyChart data={activeAnalysis} />
                  <div className="glass p-10 rounded-[3rem] border border-white/5 bg-slate-950/40 shadow-2xl">
                    <h3 className="text-[11px] font-black uppercase text-slate-500 mb-6 tracking-[0.5em] italic">Operational Summary</h3>
                    <p className="text-2xl text-slate-300 font-light leading-relaxed italic border-l-4 border-indigo-500 pl-8">
                      "{activeAnalysis.summary}"
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Loading Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center">
           <div className="relative mb-12">
             <div className="w-32 h-32 rounded-full border-[6px] border-indigo-500/10 border-t-indigo-500 animate-spin shadow-[0_0_50px_rgba(99,102,241,0.3)]"></div>
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 animate-pulse border border-indigo-500/30"></div>
             </div>
           </div>
           <h3 className="text-2xl font-black text-white uppercase tracking-[0.5em] italic">Synthesizing Archeology</h3>
           <p className="text-indigo-400 mt-6 font-mono text-[10px] uppercase tracking-widest animate-pulse">
             Indexing cross-drive entropy... salvaging logic signatures...
           </p>
        </div>
      )}
    </div>
  );
};

export default App;
