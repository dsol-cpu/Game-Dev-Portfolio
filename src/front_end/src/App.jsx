import { BookPageFlip } from "./components/BookPageFlip";
import Sidebar from "./components/Sidebar";
import Footer from "./components/Footer";
import WebGLBook from "./components/WebGLBook"; // Import the WebGLBook component

const App = () => {
  return (
    <div class="flex h-screen">
      <Sidebar />
      {/* Main Content Area - Adjust for fixed sidebar */}
      <main class="flex-1 ml-64 flex flex-col">
        <WebGLBook />
        <Footer />
      </main>
    </div>
  );
};

export default App;
