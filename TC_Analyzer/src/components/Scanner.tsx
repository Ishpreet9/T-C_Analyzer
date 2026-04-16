import axios from "axios";
import { useEffect, type Dispatch, type SetStateAction } from "react";
import { type AnalysisResultType } from "../types/types";

type childProps = {
  setState: Dispatch<SetStateAction<string>>;
  setAnalysisData: Dispatch<SetStateAction<AnalysisResultType>>;
};

const saveToCache = async (data: AnalysisResultType, url: string) => {
  // const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (url) {
    const storageObject = { [url]: data };
    chrome.storage.local.set(storageObject, () => {
      console.log("Data cached for url: ", url);
    })
  }
}

const Scanner = ({ setState, setAnalysisData }: childProps) => {
  // get current active tab
  const runScan = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if(!tab?.url || !tab?.id)
    {
      console.log("No valid tab or url found");
      setState('error');
      return;
    }
    const url: string = tab?.url;
    // checking tab availability
    if (!tab?.id) {
      console.log("No tab found");
      return;
    }
    // inject script to grab all text
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: () => {
          // 1. KILL LIST (Tags that are ALWAYS garbage)
          const trashSelectors = [
            "script", "style", "noscript", "iframe", "form", "svg", "img", "input", "button", "figure", "video",
            // Specific YouTube/Modern App Sidebars
            "ytd-guide-renderer", "ytd-mini-guide-renderer", "tp-yt-app-drawer",
            "[role='navigation']", "[role='banner']", "[role='contentinfo']"
          ];

          const virtualBody = document.body.cloneNode(true) as HTMLElement;

          trashSelectors.forEach(sel => {
            virtualBody.querySelectorAll(sel).forEach(el => el.remove());
          });

          // 2. THE NUCLEAR SCAN (Check every single element)
          const candidates = virtualBody.querySelectorAll("*");

          candidates.forEach((el) => {
            const element = el as HTMLElement;
            // Skip the body itself
            if (element.tagName === "BODY") return;

            const text = element.innerText.trim();
            const textLength = text.length;

            // Rule A: Garbage (Tiny text)
            if (textLength < 15) {
              element.remove();
              return;
            }

            // --- RULE F: THE "BY ASSOCIATION" CHECK (Fixes Discord) ---
            // If this element is INSIDE a link (e.g., a div inside an anchor),
            if (element.closest('a')) {
              element.remove();
              return;
            }

            // --- CALCULATE DENSITY ---
            const linkTextLength = Array.from(element.querySelectorAll('a'))
              .reduce((total, link) => total + link.innerText.length, 0);

            const density = textLength > 0 ? (linkTextLength / textLength) : 0;

            // Rule B: LINK DESTROYER (Aggressive)
            // If > 45% of the text is links, DELETE IT.
            // WE DO NOT CHECK SIZE HERE. Even if it's huge (like the Language List), it dies.
            if (density > 0.45) {
              element.remove();
              return;
            }

            // Rule C: Shield (For Content)
            // Only IF it passed the density check (it's mostly text), AND it's big, we keep it.
            if (textLength > 1000) {
              return;
            }

            // Rule D: Sidebar Killer (Medium Density)
            // If it's smaller (< 1000 chars) and has moderate links (> 25%), kill it.
            if (density > 0.25) {
              element.remove();
              return;
            }

            // Rule E: Named Junk Fallback
            // Catches "Copyright" footers or named sidebars that have few links
            const className = (element.className || "").toString().toLowerCase();
            const tagName = element.tagName.toLowerCase();

            if (
              tagName === 'nav' ||
              tagName === 'footer' ||
              tagName === 'aside' ||
              className.includes('sidebar') ||
              className.includes('menu') ||
              className.includes('drawer') ||
              className.includes('nav')
            ) {
              element.remove();
            }
          });

          // return virtualBody.innerText.replace(/\s+/g, " ").trim();
          return virtualBody.innerText.trim();
        },
      },
      (results: chrome.scripting.InjectionResult<string>[]) => {
        if (results && results[0]) {
          const extractedText = results[0].result;
          axios.post("http://localhost:3000/api/ai/analysis", {
            tc_data: extractedText,
            url: url
          })
            .then((response) => {
              const data = response.data.data;
              // console.log(data);
              console.log(typeof data);

              // 2. The correct way to check for an Array
              console.log("Is it an array?", Array.isArray(data));

              // 3. See the actual data and its structure
              console.log("Actual Data:", data);

              // parse to convert string to object
              if (typeof data === 'string') {
                let parsedData = JSON.parse(data);
                saveToCache(parsedData, url);
                setAnalysisData(parsedData);
              }
              else {
                saveToCache(data, url);
                setAnalysisData(data);
              }
              setState("fetched");
            })
        } else {
          console.log("Error fetching data");
        }
      },
    );
  };

  useEffect(() => {
    runScan();
  }, []);

  return (
<div className="flex flex-col w-full h-screen min-h-[400px] bg-[#222222] text-white font-sans">
      {/* Header Bar - Remove this block if your header is handled in a parent layout component */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-[#333333]">
        <div className="flex items-center gap-2">
          {/* Shield Icon */}
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
          </svg>
          <span className="font-semibold text-gray-300 text-sm tracking-wide">T&C ANALYZER</span>
        </div>
        {/* Settings Icon */}
        <button className="text-gray-400 hover:text-white transition-colors cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>

      {/* Main Scanning Content */}
      <div className="flex flex-col flex-1 justify-center items-center p-6">
        {/* Loading Spinner */}
        <div className="w-[88px] h-[88px] rounded-full border-[6px] border-[#3a3a3a] border-t-[#fcc201] animate-spin mb-8"></div>
        
        {/* Text */}
        <h2 className="text-[26px] font-bold text-white mb-2 tracking-tight">Analyzing Page</h2>
        <p className="text-[15px] text-gray-400">Please wait while we check the terms...</p>
      </div>
    </div>
  );
};

export default Scanner;
