import {Avatar, Button, Container, Flex, Panel, Typography} from "@maxhub/max-ui";
import {Link} from "react-router";

//пока в компонент не передаются пропсы
export default function UserProfile(){
    return (
        <Panel centeredX={true} centeredY={true} >
            <Flex gap={50} direction="column" align="center">
                <Container>
                    <Flex gap={30} direction="column" align="center">
                        <Avatar.Image form="circle"
                                      src=''
                                      fallback="ME"
                                      fallbackGradient='blue'/>
                        <Flex gap={20} direction="column" align="center">
                            <Typography.Headline variant='medium'>
                                Иванов Иван Иванович
                            </Typography.Headline>
                            <Typography.Headline variant='medium'>
                                Владелец квартиры
                            </Typography.Headline>
                        </Flex>
                        <Typography.Headline variant='small'>
                            ул.Водопьянова, д.37, кв.10
                        </Typography.Headline>
                    </Flex>
                </Container>
                <Container>
                    <Flex gap={10} direction="column" align="center">
                        <Button asChild
                                appearance="neutral"
                                mode="secondary"
                                stretched
                        >
                            <Link to={'/form'}>
                                Создать заявку
                            </Link>
                        </Button>
                    </Flex>
                </Container>
            </Flex>
        </Panel>
    )
}