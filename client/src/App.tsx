import { Routes, Route } from 'react-router';
import Home from './pages/Home';
import Profile from './pages/Profile';
import News from './pages/News';
import Requests from './pages/Requests';
import Header from './components/Header';
import NavBar from './components/NavBar';
import { AuthProvider } from './auth/AuthProvider';
import s from './App.module.scss';

export default function App() {
  return (
    <div className={s.app}>
      <AuthProvider>
        <Header />
        <main className={s.main}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/news" element={<News />} />
            <Route path="/requests" element={<Requests />} />
          </Routes>
        </main>
        <NavBar />
      </AuthProvider>
    </div>
  );
}
