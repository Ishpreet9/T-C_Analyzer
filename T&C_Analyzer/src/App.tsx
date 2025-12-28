import { useState } from "react";
import Home from "./components/Home";
import Scanner from "./components/Scanner";

const App = () => {
  const [state, setState] = useState<string>("idle");
  return (
    <div className="w-full h-full">
      {state === "idle" ? (
        <Home setState={setState} />
      ) : (
        <Scanner setState={setState} />
      )}
    </div>
  );
};

export default App;
