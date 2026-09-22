import { prisma } from '../src/lib/db.js';
import { config } from '../src/config.js';
import { votesRequiredFor } from '../src/services/rules.js';

async function main() {
  const company = await prisma.managementCompany.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'УК «Комфорт-Сервис»',
      phone: '+7 (843) 200-10-10',
      email: 'info@comfort-service.example',
      address: 'г. Казань, ул. Примерная, 1, офис 5',
      workingHours: 'Пн–Пт 9:00–18:00, аварийная служба круглосуточно',
    },
  });

  const houseSpecs = [
    {
      address: 'Волгоградская улица, 5',
      lat: 55.8285919,
      lng: 49.0850117,
      apartmentsCount: 80,
      entrances: [
        { number: '1', from: 1, to: 20 },
        { number: '2', from: 21, to: 40 },
        { number: '3', from: 41, to: 60 },
        { number: '4', from: 61, to: 80 },
      ],
      externalId: 'osm:way/61424311',
      dataSource: 'osm',
    },
    {
      address: 'улица Декабристов, 114',
      lat: 55.8287408,
      lng: 49.0826515,
      apartmentsCount: 64,
      entrances: [],
      externalId: 'osm:way/73833650',
      dataSource: 'osm',
    },
  ];
  const houses = [];
  for (const spec of houseSpecs) {
    const existing = await prisma.house.findFirst({ where: { OR: [{ externalId: spec.externalId }, { address: spec.address }] } });
    houses.push(
      existing
        ? await prisma.house.update({ where: { id: existing.id }, data: spec })
        : await prisma.house.create({ data: { ...spec, votePercent: config.votes.defaultPercent, companyId: company.id } }),
    );
  }
  const [house1, house2] = houses;

  const orgSpecs = [
    { name: 'Лифтовая служба «ЛифтСервис»', email: 'lift@example.org', phone: '+7 (843) 300-00-01', categories: ['ELEVATOR'] },
    { name: 'МУП «Водоканал»', email: 'dispatch@vodokanal.example', phone: '+7 (843) 300-00-02', categories: ['PLUMBING'] },
    { name: 'АО «Сетевая компания»', email: 'avaria@setevaya.example', phone: '+7 (843) 300-00-03', categories: ['ELECTRICITY'] },
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

  for (const maxUserId of config.uk.adminIds) {
    await prisma.user.upsert({
      where: { maxUserId },
      update: { role: 'UK_EMPLOYEE', companyId: company.id },
      create: { maxUserId, firstName: 'Сотрудник', lastName: 'УК', role: 'UK_EMPLOYEE', companyId: company.id },
    });
  }

  const residentSpecs = [
    { maxUserId: 900000001n, firstName: 'Иван', lastName: 'Иванов', username: 'ivan_ivanov', houseId: house1.id, apartment: '12', residentType: 'OWNER' },
    { maxUserId: 900000002n, firstName: 'Мария', lastName: 'Петрова', username: null, houseId: house1.id, apartment: '27', residentType: 'OWNER' },
    { maxUserId: 900000003n, firstName: 'Олег', lastName: 'Сидоров', username: null, houseId: house1.id, apartment: '41', residentType: 'TENANT' },
    { maxUserId: 900000004n, firstName: 'Анна', lastName: 'Кузнецова', username: null, houseId: house1.id, apartment: '58', residentType: 'OWNER' },
    { maxUserId: 900000005n, firstName: 'Дмитрий', lastName: 'Смирнов', username: null, houseId: house1.id, apartment: '63', residentType: 'OWNER' },
    { maxUserId: 900000006n, firstName: 'Елена', lastName: 'Волкова', username: null, houseId: house2.id, apartment: '5', residentType: 'OWNER' },
  ] as const;
  const residents = [];
  for (const spec of residentSpecs) {
    residents.push(
      await prisma.user.upsert({
        where: { maxUserId: spec.maxUserId },
        update: { username: spec.username },
        create: { ...spec, onboardedAt: new Date() },
      }),
    );
  }
  const [ivan, maria, oleg, anna] = residents;

  const chairman = await prisma.user.upsert({
    where: { maxUserId: 900000007n },
    update: { role: 'CHAIRMAN', houseId: house1.id },
    create: {
      maxUserId: 900000007n,
      firstName: 'Светлана',
      lastName: 'Председателева',
      role: 'CHAIRMAN',
      houseId: house1.id,
      apartment: '3',
      residentType: 'OWNER',
      onboardedAt: new Date(),
    },
  });

  const requestsCount = await prisma.request.count();
  if (requestsCount === 0) {
    const residentsInHouse1 = await prisma.user.count({ where: { houseId: house1.id, role: 'RESIDENT', onboardedAt: { not: null } } });
    const required = votesRequiredFor(residentsInHouse1, house1.votePercent);
    const inTwoWeeks = new Date();
    inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);

    const painting = await prisma.request.create({
      data: {
        houseId: house1.id,
        authorId: ivan.id,
        title: 'Ремонт подъезда: обновить краску на стенах',
        description: 'В третьем подъезде облупилась краска на стенах между 1 и 3 этажами. Просим включить покраску в план текущего ремонта.',
        category: 'REPAIR',
        status: 'VOTING',
        votesRequired: required,
        deadline: inTwoWeeks,
        statusHistory: { create: { oldStatus: null, newStatus: 'VOTING', changedById: ivan.id } },
      },
    });

    const noise = await prisma.request.create({
      data: {
        houseId: house1.id,
        authorId: maria.id,
        title: 'Шум и соседи: ремонт по ночам в кв. 30',
        description: 'Соседи из квартиры 30 регулярно сверлят после 23:00. Просим УК направить предупреждение и зафиксировать нарушение.',
        category: 'NOISE',
        status: 'SUBMITTED',
        votesRequired: required,
        votesCount: required,
        deadline: inTwoWeeks,
        submittedAt: new Date(),
        statusHistory: {
          create: [
            { oldStatus: null, newStatus: 'VOTING', changedById: maria.id },
            { oldStatus: 'VOTING', newStatus: 'SUBMITTED', comment: `Собрано ${required} из ${required} подписей` },
          ],
        },
      },
    });
    const voters = [oleg, anna, ivan].slice(0, required);
    await prisma.vote.createMany({ data: voters.map((voter) => ({ requestId: noise.id, userId: voter.id })) });

    await prisma.request.create({
      data: {
        houseId: house1.id,
        authorId: oleg.id,
        title: 'Лифт: застрял лифт во 2 подъезде',
        description: 'Лифт во втором подъезде остановился между 5 и 6 этажами, внутри люди. Нужна аварийная служба.',
        category: 'ELEVATOR',
        priority: 'EMERGENCY',
        status: 'IN_PROGRESS',
        votesRequired: 0,
        submittedAt: new Date(),
        statusHistory: {
          create: [
            { oldStatus: null, newStatus: 'SUBMITTED', changedById: oleg.id, comment: 'Аварийная заявка передана в УК без сбора подписей' },
            { oldStatus: 'SUBMITTED', newStatus: 'IN_PROGRESS', comment: 'Вызвана аварийная бригада' },
          ],
        },
      },
    });

    await prisma.request.create({
      data: {
        houseId: house1.id,
        authorId: anna.id,
        title: 'Уборка и двор: не вывозят мусор',
        description: 'Контейнерная площадка переполнена третий день.',
        category: 'CLEANING',
        status: 'RESOLVED',
        votesRequired: required,
        votesCount: required,
        submittedAt: new Date(Date.now() - 3 * 86_400_000),
        resolvedAt: new Date(),
        statusHistory: {
          create: [
            { oldStatus: null, newStatus: 'VOTING', changedById: anna.id },
            { oldStatus: 'VOTING', newStatus: 'SUBMITTED', comment: `Собрано ${required} из ${required} подписей` },
            { oldStatus: 'SUBMITTED', newStatus: 'RESOLVED', comment: 'Мусор вывезен, график скорректирован' },
          ],
        },
      },
    });

    console.log(`Создано 4 демо-заявки (первая: №${painting.id}), порог подписей для «${house1.address}»: ${required}`);
  }

  const announcementsCount = await prisma.announcement.count({ where: { houseId: house1.id } });
  if (announcementsCount === 0) {
    await prisma.announcement.create({
      data: {
        houseId: house1.id,
        authorId: chairman.id,
        title: 'Отключение горячей воды',
        description: 'С 25 по 26 сентября проводится плановое опрессование системы отопления, горячей воды не будет.',
      },
    });
    console.log(`Создано демо-объявление от председателя ТСЖ для дома «${house1.address}».`);
  }

  const newsCount = await prisma.news.count({ where: { houseId: house1.id } });
  if (newsCount === 0) {
    await prisma.news.create({
      data: {
        houseId: house1.id,
        authorId: ivan.id,
        title: 'Зову на чай в честь новоселья',
        description: 'В субботу в 18:00 жду соседей на чай, кв. 12. Заходите познакомиться!',
        contact: 'кв. 12 или напишите в боте /id 900000001',
      },
    });
    console.log(`Создана демо-новость от жителя для дома «${house1.address}».`);
  }

  const applicant = await prisma.user.upsert({
    where: { maxUserId: 900000008n },
    update: {},
    create: {
      maxUserId: 900000008n,
      firstName: 'Николай',
      lastName: 'Новосёлов',
      houseId: house1.id,
      apartment: '9',
      residentType: 'OWNER',
    },
  });

  const pendingCount = await prisma.membershipRequest.count({ where: { houseId: house1.id, status: 'PENDING' } });
  if (pendingCount === 0) {
    await prisma.membershipRequest.create({
      data: {
        applicantId: applicant.id,
        houseId: house1.id,
        apartment: '9',
        fullName: 'Новосёлов Николай Николаевич',
        status: 'PENDING',
      },
    });
    console.log(`Создана демо-заявка на вступление для дома «${house1.address}» — ждёт подтверждения председателя ТСЖ.`);
  }

  console.log('Seed выполнен: УК, дома, организации, жители, председатель ТСЖ готовы.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
