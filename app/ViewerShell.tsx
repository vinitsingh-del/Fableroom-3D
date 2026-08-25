"use client";

import dynamic from "next/dynamic";

const CabinetViewer = dynamic(() => import("./CabinetViewer"), {
  ssr: false,
  loading: () => (
    <div className="viewer-shell">
      <div className="loading-screen" role="status" aria-live="polite">
        <div className="loading-orbit"><i /><i /><i /></div>
        <strong>Opening the 3D viewer</strong>
        <span>Preparing the interactive cabinet</span>
        <div className="loading-track"><b style={{ width: "42%" }} /></div>
      </div>
    </div>
  ),
});

export default function ViewerShell() {
  return <CabinetViewer />;
}
