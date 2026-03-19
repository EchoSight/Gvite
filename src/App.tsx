import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/AppSidebar";
import { DiceFloatingButton } from "@/components/DiceFloatingButton";
import { GameProvider } from "@/lib/GameContext";
import Index from "./pages/Index";
import CreateCharacter from "./pages/CreateCharacter";
import CharacterView from "./pages/CharacterView";
import Resources from "./pages/Resources";
import DiceRoller from "./pages/DiceRoller";
import Maps from "./pages/Maps";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <GameProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="flex min-h-screen bg-background">
            <AppSidebar />
            <main className="flex-1 min-w-0 pt-12 md:pt-0">
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/create" element={<CreateCharacter />} />
                <Route path="/character/:id" element={<CharacterView />} />
                <Route path="/resources" element={<Resources />} />
                <Route path="/dice" element={<DiceRoller />} />
                <Route path="/maps" element={<Maps />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <DiceFloatingButton />
          </div>
        </BrowserRouter>
      </GameProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
