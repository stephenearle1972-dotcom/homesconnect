import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import ChatWidget from './components/ChatWidget';
import HomePage from './pages/HomePage';
import ListingsPage from './pages/ListingsPage';
import ListingDetailPage from './pages/ListingDetailPage';
import AgentPage from './pages/AgentPage';
import SearchPage from './pages/SearchPage';
import ListPropertyPage from './pages/ListPropertyPage';
import ListingSuccessPage from './pages/ListingSuccessPage';
import ConveyancersPage from './pages/ConveyancersPage';
import ListConveyancerPage from './pages/ListConveyancerPage';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-grad-dark">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/listings" element={<ListingsPage />} />
          <Route path="/listing/:id" element={<ListingDetailPage />} />
          <Route path="/agent/:slug" element={<AgentPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/list-property" element={<ListPropertyPage />} />
          <Route path="/listing-success" element={<ListingSuccessPage />} />
          <Route path="/conveyancers" element={<ConveyancersPage />} />
          <Route path="/list-conveyancer" element={<ListConveyancerPage />} />
        </Routes>
      </main>
      <Footer />
      <ChatWidget />
    </div>
  );
}
