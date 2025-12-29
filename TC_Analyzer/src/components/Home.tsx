import type { Dispatch, SetStateAction } from "react";

type ChildProps = {
  setState: Dispatch<SetStateAction<string>>;
};

const Home = ({ setState }: ChildProps) => {
  return (
    // Outer container matches the dark background of the app
    <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-neutral-900">
      
      {/* Main Card - Matches ResultView style exactly */}
      <div className="w-full max-w-lg bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl overflow-hidden">
        
        {/* Header - Matches ResultView header style */}
        <div className="p-6 border-b border-neutral-700 bg-neutral-800 flex justify-center">
          <h1 className="text-xl font-semibold text-neutral-200 tracking-wide uppercase">
            T&C Analyzer
          </h1>
        </div>

        {/* Content Section */}
        <div className="p-10 flex flex-col items-center text-center space-y-8">
          
          {/* Icon - Clean, no glow */}
          <div className="p-4 bg-neutral-700/50 rounded-full border border-neutral-600">
            <svg 
              className="w-12 h-12 text-blue-400" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>

          {/* Text Content */}
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-white">
              No Analysis Yet
            </h2>
            <p className="text-neutral-400 text-sm leading-relaxed max-w-xs mx-auto">
              Scan the current page to detect hidden clauses, privacy risks, and unfair terms instantly.
            </p>
          </div>

          {/* Action Button - Matches the "Score" color theme */}
          <button
            onClick={() => setState("scanning")}
            className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors duration-200 border border-blue-500 shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            Scan Current Page
          </button>

        </div>
        
        {/* Footer / Status bar */}
        <div className="px-6 py-3 bg-neutral-900/50 border-t border-neutral-700 text-center">
            <p className="text-xs text-neutral-500 uppercase tracking-widest">Ready to protect you</p>
        </div>

      </div>
    </div>
  );
};

export default Home;