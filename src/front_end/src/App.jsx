import Sidebar from "./components/UI/Sidebar";
import ThreeScene from "./components/ThreeScene";
import { createThemeManager } from "./stores/theme";

createThemeManager();
const App = () => {
  return (
    <div class="flex h-screen">
      <Sidebar />
      {/* Main Content Area - Adjust for fixed sidebar */}
      <main class="flex-1 ml-64 flex flex-col">
        <ThreeScene />
      </main>
    </div>
  );
};

export default App;
