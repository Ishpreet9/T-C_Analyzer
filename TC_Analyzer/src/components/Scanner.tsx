import axios from "axios";
import { useEffect, type Dispatch, type SetStateAction } from "react";
import { type AnalysisResultType } from "../types/types";

type childProps = {
  setState: Dispatch<SetStateAction<string>>;
  setAnalysisData: Dispatch<SetStateAction<AnalysisResultType>>;
};

const saveToCache = async (data: AnalysisResultType) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) {
    const url = tab.url;
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

            // --- RULE F: THE "GUILT BY ASSOCIATION" CHECK (Fixes Discord) ---
            // If this element is INSIDE a link (e.g., a div inside an anchor),
            // we treat it as a link.
            if (element.closest('a')) {
              element.remove();
              return;
            }

            // --- CALCULATE DENSITY ---
            const linkTextLength = Array.from(element.querySelectorAll('a'))
              .reduce((total, link) => total + link.innerText.length, 0);

            const density = textLength > 0 ? (linkTextLength / textLength) : 0;

            // Rule B: THE LINK DESTROYER (Aggressive)
            // If > 45% of the text is links, DELETE IT.
            // WE DO NOT CHECK SIZE HERE. Even if it's huge (like the Language List), it dies.
            if (density > 0.45) {
              element.remove();
              return;
            }

            // Rule C: The Boss Shield (For Content)
            // Only IF it passed the density check (it's mostly text), AND it's big, we keep it.
            if (textLength > 1000) {
              return;
            }

            // Rule D: The Sidebar Killer (Medium Density)
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
            tc_data: extractedText
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
                saveToCache(parsedData);
                setAnalysisData(parsedData);
              }
              else {
                saveToCache(data);
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
    <div className="flex justify-center items-center text-2xl w-full h-full bg-neutral-600 text-white">
      Scanning...
    </div>
  );
};

export default Scanner;
