import { useState } from 'react';
import { Routes, Route } from 'react-router';
import Home from './pages/Home';
import Profile from './pages/Profile';
import News from './pages/News';
import Announcements from './pages/Announcements';
import Requests from './pages/Requests';
import RequestCreate from './pages/RequestCreate';
import Membership from './pages/Membership';
import Header from './components/Header';
import NavBar from './components/NavBar';
import HouseJoinFlow from './components/HouseJoinFlow';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { ToastProvider } from './components/Toast/ToastProvider';
import { PORTAL_ROOT_ID } from './lib/portalRoot';
import s from './App.module.scss';

function AppShell() {
  const { user } = useAuth();
  const [addingHouse, setAddingHouse] = useState(false);

  if (addingHouse) {
    return (
      <HouseJoinFlow
        defaultFullName={user.verifiedFullName ?? user.name}
        eyebrow="Ещё дом"
        title="Выберите дом"
        onCancel={() => setAddingHouse(false)}
        onSuccess={() => setAddingHouse(false)}
      />
    );
  }

  return (
    <>
      <Header onAddHouse={() => setAddingHouse(true)} />
      <main className={s.main}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/news" element={<News />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/requests/new" element={<RequestCreate />} />
          <Route path="/membership" element={<Membership />} />
        </Routes>
      </main>
      <NavBar />
    </>
  );
}

export default function App() {
  return (
    <div className={s.app}>
      <ToastProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ToastProvider>
      <div id={PORTAL_ROOT_ID} />
    </div>
  );
}
