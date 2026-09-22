import { Routes, Route } from 'react-router';
import Home from './pages/Home';
import Profile from './pages/Profile';
import News from './pages/News';
import Header from './components/Header';
import NavBar from './components/NavBar';
import s from './App.module.scss';


export default function App() {
  return (
    <div className={s.app}>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/news" element={<News />} />
      </Routes>
      <NavBar />
    </div>
  )
}
