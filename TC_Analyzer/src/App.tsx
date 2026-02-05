import { useEffect, useState } from "react";
import Home from "./components/Home";
import Scanner from "./components/Scanner";
import ResultView from "./components/ResultView";
import { type AnalysisResultType } from "./types/types";

type StorageWrapper = {
  [key: string]: AnalysisResultType | undefined;
};

const App = () => {
  const [state, setState] = useState<string>("idle");
  const [analysisData, setAnalysisData] = useState<AnalysisResultType | any>();

  // const [loading,setLoading] = useState<boolean>(false);

  useEffect(() => {
    // get active tab
    checkCacheForCurrentTab()

  }, []);

  const checkCacheForCurrentTab = async () => {

    // setLoading(true);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab?.url) {
      // check local storage
      chrome.storage.local.get([tab.url], (result: StorageWrapper) => {
        if (result[tab.url as keyof StorageWrapper]) {
          console.log("Cache Hit. Data found.");
          setAnalysisData(result[tab.url as keyof StorageWrapper]);
        }
      })
    }
    else {
      // setLoading(false);
    }

  }

  return (
    <div className="relative w-full h-full">
      <div className="flex flex-col absolute z-10">
        <div className="absolute top-0 left-0 w-40 h-40 bg-blue-400/50 rounded-full"></div>
        <div className="absolute top-20 left-50 w-50 h-50 bg-blue-400/50 rounded-full"></div>
        <div className="absolute top-70 left-4 w-55 h-55 bg-blue-400/50 rounded-full"></div>
        <div className="absolute top-85 left-70 w-30 h-30 bg-blue-400/50 rounded-full"></div>
        
      </div>
      <div className="absolute z-20 w-full h-full overflow-scroll custom-scroll">
        {state === "idle" && !analysisData ? (
          <Home setState={setState} />
        ) : state === "scanning" && !analysisData ? (
          <Scanner setState={setState} setAnalysisData={setAnalysisData} />
        ) :
          (
            <ResultView analysisData={analysisData} setAnalysisData={setAnalysisData} setState={setState} />
          )
        }
      </div>
    </div>
  );
};

export default App;
