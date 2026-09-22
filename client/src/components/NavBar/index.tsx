import { NavLink } from "react-router";
import { HomeIcon, UserIcon, NewspaperIcon } from 'lucide-react';
import s from './NavBar.module.scss';

const items = [
  { id: 1, path: '/', name: 'Home', icon: <HomeIcon /> },
  { id: 2, path: '/profile', name: 'Profile', icon: <UserIcon /> },
  { id: 3, path: '/news', name: 'News', icon: <NewspaperIcon /> },
];

export default function NavBar() {
  return (
    <nav className={s.nav}>
      <ul className={s.list}>
        {items.map((item) => (
          <li className={s.item} key={item.id}>
            <NavLink
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                isActive ? `${s.link} ${s.active}` : s.link
              }
            >
              {item.icon}
              <span className={s.name}>{item.name}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
