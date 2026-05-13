import { useEffect } from "react";
import { useTheme } from "./hooks/useTheme";
import MainLayout from "./components/Layout/MainLayout";

function App() {
  const { initTheme } = useTheme();

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  return (
    <MainLayout />
  );
}

export default App;
