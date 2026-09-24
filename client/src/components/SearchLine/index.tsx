import { Flex } from "@maxhub/max-ui";
import { Input } from "@maxhub/max-ui";
import { Search } from "lucide-react";
import s from './SearchLine.module.scss';


export default function SearchLine() {
    return (
        <Flex direction="row" gap={12} asChild className={s.searchLine}>
            <Input placeholder="Поиск" size="medium" iconAfter={<Search color="var(--icon-primary)" />} />
        </Flex>
    )
}