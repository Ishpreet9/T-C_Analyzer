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

  useEffect(()=>{
    // get active tab
    checkCacheForCurrentTab()

  },[]);
  
  const checkCacheForCurrentTab = async () => {

    // setLoading(true);
    
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab?.url)
      {
        // check local storage
        chrome.storage.local.get([tab.url], (result: StorageWrapper)=>{
          if(result[tab.url as keyof StorageWrapper])
          {
            console.log("Cache Hit. Data found.");
            setAnalysisData(result[tab.url as keyof StorageWrapper]);
          }
        })
      }
      else
      {
        // setLoading(false);
      }

  }

  return (
    <div className="w-full h-full bg-neutral-800 overflow-scroll custom-scroll">
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
  );
};

export default App;
