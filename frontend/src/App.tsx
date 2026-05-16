import { BrowserRouter, Route, Routes } from "react-router";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";

export function App() {
  return (
      <BrowserRouter>
        <Routes>
          <Route path="/Auth" element={<Auth />} />
          <Route path="/" element={<Dashboard />} />
        </Routes>
      
      </BrowserRouter>
  );
}

export default App;
