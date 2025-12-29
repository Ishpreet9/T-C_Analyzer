import { useState } from "react";
import Home from "./components/Home";
import Scanner from "./components/Scanner";
import ResultView from "./components/ResultView";
import { type AnalysisResultType } from "./types/types";

const App = () => {
  const [state, setState] = useState<string>("idle");
  const [analysisData, setAnalysisData] = useState<AnalysisResultType | any>();
  return (
    <div className="w-full h-full bg-neutral-800 overflow-scroll custom-scroll">
    {state === "idle" ? (
        <Home setState={setState} />
      ) : state === "scanning" ? (
        <Scanner setState={setState} setAnalysisData={setAnalysisData} />
      ) :
      (
        <ResultView analysisData={analysisData} />
      ) 
      }
    </div>
  );
};

export default App;
