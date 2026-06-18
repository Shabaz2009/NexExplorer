import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import { useTheme } from "./hooks/useTheme";
import { useSettingsStore } from "./store/settingsStore";
import MainLayout from "./components/Layout/MainLayout";

function App() {
  const { initTheme } = useTheme();
  const disableAnimations = useSettingsStore(s => s.disableAnimations);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  return (
    // When disableAnimations is true, all Framer Motion transitions
    // use 0 duration — effectively killing all animations globally.
    <MotionConfig reducedMotion={disableAnimations ? "always" : "never"}>
      <MainLayout />
    </MotionConfig>
  );
}

export default App;
