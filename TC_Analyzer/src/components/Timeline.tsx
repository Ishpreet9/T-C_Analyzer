const Timeline = () => {
    return (
        <div className="w-full h-full bg-neutral-800 flex flex-col text-white">
            {/* title */}
            <span className="text-lg py-2 border-b border-neutral-600 w-full text-center">Website Name - Timeline</span>
            {/* timeline */}
            <div className="flex-1 w-full py-4 overflow-scroll custom-scroll">
                <div className="flex w-full min-h-full pt-4">
                    {/* left line */}
                    <div className="min-h-full w-7 border-r border-neutral-300"></div>
                    {/* timeline content */}
                    <div className="px-6 flex-1 h-full flex flex-col gap-6">

                        <div className="flex relative flex-col w-full">
                            {/* date */}
                            <span className="w-full bg-neutral-600/50 px-4 py-1 rounded-t-lg">May 16, 2025</span>
                            {/*list of added and removed clauses */}
                            <div className="bg-black/50 flex flex-col justify-center items-center p-3 gap-3 rounded-b-lg">
                                <div className="flex flex-col bg-green-400/20 w-full px-2 py-1 rounded-md">
                                    <span className="text-green-300 text-[12px]">+ ADDED</span>
                                    <span className="text-md">We reserve the right to share your data with marketing partners. </span>
                                </div>
                                <div className="flex flex-col bg-red-400/20 w-full px-2 py-1 rounded-md">
                                    <span className="text-red-300 text-[12px]">- REMOVED</span>
                                    <span className="text-md">We will not share your data with third parties.</span>
                                </div>
                            </div>
                            <div className="-left-6 -translate-x-1/2 absolute w-6 h-6 bg-neutral-800 top-6 border-t-2 border-2 rounded-full ">
                                <span className="w-3 h-3 bg-neutral-800 absolute top-1/2 -translate-y-1/2 left-1/2 translate-x-1/2"></span>
                                <span className="w-3 h-3 bg-neutral-800 absolute top-1/2 -translate-y-1/2 right-1/2 -translate-x-1/2"></span>
                                <span className="w-3 h-3 z-10 bg-neutral-800 absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 rounded-full border-2"></span>
                            </div>
                        </div>

                        <div className="flex relative flex-col w-full">
                            {/* date */}
                            <span className="w-full bg-neutral-600/50 px-4 py-1 rounded-t-lg">May 16, 2025</span>
                            {/*list of added and removed clauses */}
                            <div className="bg-black/50 flex flex-col justify-center items-center p-3 gap-3 rounded-b-lg">
                                <div className="flex flex-col bg-green-400/20 w-full px-2 py-1 rounded-md">
                                    <span className="text-green-300 text-[12px]">+ ADDED</span>
                                    <span className="text-md">We reserve the right to share your data with marketing partners. </span>
                                </div>
                                <div className="flex flex-col bg-red-400/20 w-full px-2 py-1 rounded-md">
                                    <span className="text-red-300 text-[12px]">- REMOVED</span>
                                    <span className="text-md">We will not share your data with third parties.</span>
                                </div>
                            </div>
                            <div className="-left-6 -translate-x-1/2 absolute w-6 h-6 bg-neutral-800 top-6 border-t-2 border-2 rounded-full ">
                                <span className="w-3 h-3 bg-neutral-800 absolute top-1/2 -translate-y-1/2 left-1/2 translate-x-1/2"></span>
                                <span className="w-3 h-3 bg-neutral-800 absolute top-1/2 -translate-y-1/2 right-1/2 -translate-x-1/2"></span>
                                <span className="w-3 h-3 z-10 bg-neutral-800 absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 rounded-full border-2"></span>
                            </div>
                        </div>

                        <div className="flex relative flex-col w-full">
                            {/* date */}
                            <span className="w-full bg-neutral-600/50 px-4 py-1 rounded-t-lg">May 16, 2025</span>
                            {/*list of added and removed clauses */}
                            <div className="bg-black/50 flex flex-col justify-center items-center p-3 gap-3 rounded-b-lg">
                                <div className="flex flex-col bg-green-400/20 w-full px-2 py-1 rounded-md">
                                    <span className="text-green-300 text-[12px]">+ ADDED</span>
                                    <span className="text-md">We reserve the right to share your data with marketing partners. </span>
                                </div>
                                <div className="flex flex-col bg-red-400/20 w-full px-2 py-1 rounded-md">
                                    <span className="text-red-300 text-[12px]">- REMOVED</span>
                                    <span className="text-md">We will not share your data with third parties.</span>
                                </div>
                            </div>
                            <div className="-left-6 -translate-x-1/2 absolute w-6 h-6 bg-neutral-800 top-6 border-t-2 border-2 rounded-full ">
                                <span className="w-3 h-3 bg-neutral-800 absolute top-1/2 -translate-y-1/2 left-1/2 translate-x-1/2"></span>
                                <span className="w-3 h-3 bg-neutral-800 absolute top-1/2 -translate-y-1/2 right-1/2 -translate-x-1/2"></span>
                                <span className="w-3 h-3 z-10 bg-neutral-800 absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 rounded-full border-2"></span>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    )
}

export default Timeline