import { Button, Flex, Input, Typography } from '@maxhub/max-ui';
import s from './Header.module.scss';
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import SearchLine from '../SearchLine';

export default function Header() {
  const [selectedHouse] = useState<string | null>(null);
  const [modal, setModal] = useState(false);

  const handleAddHouse = () => {
    setModal(true);
  };
  
  return (
    <header className={s.header}>
      <Typography.Headline variant="medium" asChild>
        <h1>Умный город</h1>
      </Typography.Headline>
      <Flex direction="row" gap={12} align="center">
        {selectedHouse ? (
          <Typography.Body variant="small">{selectedHouse}</Typography.Body>
        ) : (
          <Button variant="secondary" size="small" iconBefore={<Plus color="var(--text-primary)" />} onClick={handleAddHouse}>
            <Typography.Text variant="body">Добавить квартиру</Typography.Text>
          </Button>
        )}
      </Flex>
      {modal && (
        <div className={s.modal} onClick={() => setModal(false)}>
          <div className={s.modalContent} onClick={(e) => e.stopPropagation()}>
            <X color="var(--text-primary)" onClick={() => setModal(false)} />
            <SearchLine />
            <Typography.Headline variant="medium" asChild>
              <h2>Добавить квартиру</h2>
            </Typography.Headline>
            
            <Input placeholder="Номер квартиры" />
            <Button variant="secondary" size="small" iconBefore={<Plus color="var(--text-primary)" />} onClick={handleAddHouse}>
              Добавить
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
