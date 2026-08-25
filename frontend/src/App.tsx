import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Analyse } from "./routes/Analyse";
import { Model } from "./routes/Model";
import { Overview } from "./routes/Overview";
import { Results } from "./routes/Results";
import { Upload } from "./routes/Upload";
import { useTheme } from "./state/theme";

export function App() {
  useTheme(); // applies the stored theme class before anything paints
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Upload />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/analyse" element={<Analyse />} />
        <Route path="/model" element={<Model />} />
        <Route path="/results" element={<Results />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
