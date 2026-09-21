import {Routes, Route, useLocation} from 'react-router';
import {Panel} from "@maxhub/max-ui";
import Form from "./pages/Form";
import UserProfile from "./pages/Profile";

export default function App() {
    const location = useLocation();
    const backgroundLocation = location.state?.background;
    return (
        <Panel centeredX={true} centeredY={true} className={'panel'}>
            <header>Умный дом · заявки жителей</header>
            <Routes location={backgroundLocation || location}>
                <Route path="/" element={<UserProfile/>} />
                <Route path="/form" element={<Form />}/>
            </Routes>
        </Panel>
    )
}