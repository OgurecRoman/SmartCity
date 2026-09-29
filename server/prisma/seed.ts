import { prisma } from '../src/lib/db.js';

async function main() {
    const company = await prisma.managementCompany.upsert({
        where: { id: 1 },
        update: {},
        create: {
            name: 'УК «Комфорт-Сервис»',
            phone: '+7 (999) 999-99-99',
            email: 'info@comfort-service.example',
            address: 'г. Казань, ул. Примерная, 1, офис 5',
            workingHours: 'Пн–Пт 9:00–18:00, аварийная служба круглосуточно',
        },
    });

    const orgSpecs = [
        { name: 'Лифтовая служба «ЛифтСервис»', email: 'lift@example.org', phone: '+7 (800) 555-35-35', categories: ['ELEVATOR'] },
        { name: 'МУП «Водоканал»', email: 'dispatch@vodokanal.example', phone: '+7 (666) 666-66-66', categories: ['PLUMBING'] },
        { name: 'АО «Сетевая компания»', email: 'avaria@setevaya.example', phone: '+7 (777) 777-77-77', categories: ['ELECTRICITY'] },
        { name: 'Подрядчик по текущему ремонту', email: 'remont@example.org', phone: null, categories: ['REPAIR', 'CLEANING'] },
        { name: 'Участковый уполномоченный', email: 'uchastok@example.org', phone: '102', categories: ['NOISE', 'SECURITY'] },
    ] as const;

    for (const spec of orgSpecs) {
        const existing = await prisma.responsibleOrganization.findFirst({ where: { name: spec.name } });
        if (!existing) {
            await prisma.responsibleOrganization.create({
                data: { companyId: company.id, name: spec.name, email: spec.email, phone: spec.phone, categories: [...spec.categories] },
            });
        }
    }

    console.log('Seed выполнен: УК и ответственные организации готовы.');
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
