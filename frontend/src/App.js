import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Callback from "./pages/Callback";
import ForgotPassword from "./pages/ForgotPassword";
import Search from "./pages/Search";
import ArtPieceDetails from "./pages/ArtPieceDetails";
import NotFound from "./pages/NotFound";
import About from "./pages/About";
import Contact from "./pages/Contact";
import UserCollection from "./pages/UserCollection";
import UserProfile from "./pages/UserProfile";
import CollectionDetails from "./pages/CollectionDetails";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/callback" element={<Callback />} />
        <Route path="/search" element={<Search />} />
        <Route path="/artpiece/:external_id" element={<ArtPieceDetails />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/about" element={<About />} />
        <Route path="/collection" element={<UserCollection />} />
        <Route
          path="/collection/artpiece/:external_id"
          element={<CollectionDetails />}
        />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
