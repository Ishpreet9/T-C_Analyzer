import type { Dispatch, SetStateAction } from "react";

type childProps = {
  setState: Dispatch<SetStateAction<string>>;
};

const Home = ({ setState }: childProps) => {
  return (
    <div className="flex flex-col justify-start items-center w-full h-full bg-neutral-700">
      <div className="flex justify-center items-center bg-neutral-600 py-3 w-full shadow-2xl">
        <span className="text-neutral-300 tracking-wider font-semibold text-lg">
          T&C Analyzer
        </span>
      </div>
      <div className="flex flex-col justify-evenly items-center w-full h-full px-10 py-10">
        <div className="flex flex-col justify-center items-center gap-7 text-center">
          <span className="text-2xl font-semibold text-neutral-100">
            No Analysis Yet
          </span>
          <span className="text-xl text-neutral-300">
            Scan current page to detect hidden clauses and privacy risks.
          </span>
        </div>
        <button
          onClick={() => setState("scanning")}
          className="bg-blue-400 text-white text-2xl font-semibold py-2 px-8 rounded-lg cursor-pointer hover:bg-blue-500 transition-all duration-300"
        >
          Analyze Page
        </button>
      </div>
    </div>
  );
};

export default Home;
