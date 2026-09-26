import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Analyse } from "./routes/Analyse";
import { Clean } from "./routes/Clean";
import { Model } from "./routes/Model";
import { Overview } from "./routes/Overview";
import { Results } from "./routes/Results";
import { Upload } from "./routes/Upload";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* one layout for every screen, so the sidebar survives navigation and
            the route content can animate in and out underneath it */}
        <Route element={<Layout />}>
          <Route path="/" element={<Upload />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/analyse" element={<Analyse />} />
          <Route path="/clean" element={<Clean />} />
          <Route path="/model" element={<Model />} />
          <Route path="/results" element={<Results />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
