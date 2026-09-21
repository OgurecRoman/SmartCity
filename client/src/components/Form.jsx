import {Button, Container, Flex, Input, Panel, Textarea, Typography} from "@maxhub/max-ui";

export default function Form(){
    return (
        <Panel centeredX={true} centeredY={true}>
            <Flex gap={30} direction="column" align={"flex-start"}>
                <Input  mode="secondary" placeHolder={"Фамилия Имя Отчество"} disabeld={true}/>
                <Container fullWidth={true}>
                    <Flex gap={5} direction="column" align={"flex-start"}>
                        <Typography.Label variant={'medium-strong'}>
                            Категория:
                        </Typography.Label>
                        <Flex gap={10} direction="row">
                            <Button size="small" mode="secondary" appearance="netural">Срочно</Button>
                            <Button size="small" mode="secondary" appearance="netural">Поломка</Button>
                        </Flex>
                    </Flex>
                </Container>
                <Container fullWidth={true}>
                    <Flex gap={5} direction="column" align={"flex-start"}>
                        <Typography.Label variant={'medium-strong'}>
                            Описание проблемы:
                        </Typography.Label>
                        <Textarea defaultValue=""
                                  mode="secondary"
                                  placeholder="Проблема"/>
                    </Flex>
                </Container>
                <Container fullWidth={true}>
                    <Flex gap={5} direction="column" align={"flex-start"}>
                        <Typography.Label variant={'medium-strong'}>
                            Срок:
                        </Typography.Label>
                        <Input mode="secondary" placeHolder={"ДД.ММ.ГГГГ"} disabeld={true}/>
                    </Flex>
                </Container>
                <Container fullWidth={true}>
                    <Flex gap={10} direction="row" align={"flex-end"}>
                        <Button mode="primary" appearance="netural" >
                            Отмена
                        </Button>
                        <Button mode="primary" appearance="themed">
                            Готово
                        </Button>
                    </Flex>
                </Container>
            </Flex>
        </Panel>
    )
}