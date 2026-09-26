import { Suspense, lazy } from "react";
import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Skeleton, SkeletonCard } from "./components/primitives";
import { Upload } from "./routes/Upload";

// upload is the landing screen, so it ships in the main bundle; every other
// screen loads on first visit
const named = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((module) => ({ default: module[name] })));

const Overview = named(() => import("./routes/Overview"), "Overview");
const Analyse = named(() => import("./routes/Analyse"), "Analyse");
const Clean = named(() => import("./routes/Clean"), "Clean");
const Model = named(() => import("./routes/Model"), "Model");
const Results = named(() => import("./routes/Results"), "Results");

function RouteFallback() {
  return (
    <div className="space-y-4 px-4 pt-6 md:px-6" aria-busy="true" aria-label="Loading screen">
      <Skeleton className="h-6 w-56" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SkeletonCard chart />
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
      </div>
    </div>
  );
}

const page = (element: ReactNode) => <Suspense fallback={<RouteFallback />}>{element}</Suspense>;

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* one layout for every screen, so the sidebar survives navigation and
            the route content can animate in and out underneath it */}
        <Route element={<Layout />}>
          <Route path="/" element={<Upload />} />
          <Route path="/overview" element={page(<Overview />)} />
          <Route path="/analyse" element={page(<Analyse />)} />
          <Route path="/clean" element={page(<Clean />)} />
          <Route path="/model" element={page(<Model />)} />
          <Route path="/results" element={page(<Results />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
