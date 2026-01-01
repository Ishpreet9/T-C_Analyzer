import type { Dispatch, SetStateAction } from "react";
import type { AnalysisResultType } from "../types/types";

type ChildProps = {
  analysisData: AnalysisResultType | null; // Allow null for loading state
  setAnalysisData: Dispatch<SetStateAction<AnalysisResultType | null>>;
  setState: Dispatch<SetStateAction<string>>;
};

const ResultView = ({ analysisData, setAnalysisData, setState }: ChildProps) => {

  // 1. Loading State (Simple Pulse Effect)
  if (!analysisData) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6 bg-neutral-800 shadow-lg border border-neutral-700">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-neutral-700 rounded w-1/3"></div>
          <div className="h-32 bg-neutral-700 rounded"></div>
        </div>
        <p className="text-neutral-400 mt-4 text-center text-sm">Analyzing legal text...</p>
      </div>
    );
  }

  // 2. Determine Score Color
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400 border-emerald-500/50";
    if (score >= 50) return "text-yellow-400 border-yellow-500/50";
    return "text-red-400 border-red-500/50";
  };

  // rescan handling
  const handleRescan = async () => {

    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if(tab?.url)
    {
      chrome.storage.local.remove([tab.url], ()=>{
        setAnalysisData(null);
        setState('scanning');
        console.log("Cache cleared for current tab.");
      })
    }

  }

  return (
    <div className="w-full max-w-3xl mx-auto bg-neutral-800 text-neutral-100 shadow-2xl border border-neutral-700">
      
      {/* Header Section */}
      <div className="p-6 border-b border-neutral-700 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
          <span className="text-neutral-300">Results from local storage.</span>
          <button className="underline hover:text-neutral-200 text-neutral-400" onClick={()=>handleRescan()}>Rescan ?</button>
          </div>
          <h2 className="text-xl font-semibold text-neutral-300 uppercase tracking-wide text-center sm:text-left">
            Safety Score
          </h2>
          <div className={`text-5xl font-bold mt-2 ${getScoreColor(analysisData.score)} drop-shadow-md text-center sm:text-left`}>
            {analysisData.score}<span className="text-2xl text-neutral-500">/100</span>
          </div>
        </div>

        <div className="flex flex-col items-center sm:items-end">
          <span className="text-sm text-neutral-400 uppercase tracking-wider mb-1">Fairness Level</span>
          <span className="px-4 py-1.5 rounded-full bg-neutral-700 border border-neutral-600 font-medium text-white shadow-sm">
            {analysisData.fairness}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-8">
        
        {/* Summary Box */}
        <div className="bg-neutral-700/50 p-5 rounded-lg border border-neutral-600/50">
          <h3 className="text-lg font-semibold text-neutral-200 mb-2 flex items-center gap-2">
            📄 Executive Summary
          </h3>
          <p className="text-neutral-300 leading-relaxed text-sm sm:text-base">
            {analysisData.summary}
          </p>
        </div>

        {/* 🚩 Red Flags Section */}
        <div>
          <h3 className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
            🚨 Red Flags <span className="text-xs font-normal text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded-full">{analysisData.redFlags.length}</span>
          </h3>
          <ul className="space-y-3">
            {analysisData.redFlags.map((flag, index) => (
              <li key={index} className="flex items-start gap-3 p-3 bg-red-900/10 border border-red-900/30 rounded-lg">
                <span className="text-red-500 mt-0.5 flex-shrink-0">✖</span>
                <span className="text-neutral-300 text-sm">{flag}</span>
              </li>
            ))}
            {analysisData.redFlags.length === 0 && <p className="text-neutral-500 text-sm italic pl-2">No red flags found. Nice work!</p>}
          </ul>
        </div>

        {/* ⚠️ Yellow Flags Section */}
        <div>
          <h3 className="text-lg font-bold text-yellow-400 mb-3 flex items-center gap-2">
             ⚠️ Cautionary Items <span className="text-xs font-normal text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded-full">{analysisData.yellowFlags.length}</span>
          </h3>
          <ul className="space-y-3">
            {analysisData.yellowFlags.map((flag, index) => (
              <li key={index} className="flex items-start gap-3 p-3 bg-yellow-900/10 border border-yellow-900/30 rounded-lg">
                <span className="text-yellow-500 mt-0.5 flex-shrink-0">!</span>
                <span className="text-neutral-300 text-sm">{flag}</span>
              </li>
            ))}
             {analysisData.yellowFlags.length === 0 && <p className="text-neutral-500 text-sm italic pl-2">No warnings found.</p>}
          </ul>
        </div>

        {/* ✅ Green Flags Section */}
        <div>
          <h3 className="text-lg font-bold text-emerald-400 mb-3 flex items-center gap-2">
            ✅ Good Clauses <span className="text-xs font-normal text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded-full">{analysisData.greenFlags.length}</span>
          </h3>
          <ul className="space-y-3">
            {analysisData.greenFlags.map((flag, index) => (
              <li key={index} className="flex items-start gap-3 p-3 bg-emerald-900/10 border border-emerald-900/30 rounded-lg">
                <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                <span className="text-neutral-300 text-sm">{flag}</span>
              </li>
            ))}
             {analysisData.greenFlags.length === 0 && <p className="text-neutral-500 text-sm italic pl-2">No pros found.</p>}
          </ul>
        </div>

      </div>
    </div>
  );
};

export default ResultView;