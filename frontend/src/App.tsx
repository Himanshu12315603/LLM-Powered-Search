import { BrowserRouter, Route, Routes } from "react-router";

export function App() {
  return (
      <BrowserRouter>
        <Routes>
          <Route path="/Auth" element={<div>Hello, World!</div>} />
          <Route path="/" element={<div>Hello, Linux!</div>} />
        </Routes>
      
      </BrowserRouter>
  );
}

export default App;
