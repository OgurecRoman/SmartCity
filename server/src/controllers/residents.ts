import type { Request, Response } from 'express';
import { listResidentsOfHouse, isEmployee, isChairman } from '../services/users.js';
import { serializeResident } from '../routes/serialize.js';
import { parseQuery } from '../validation/parse.js';
import { listResidentsQuerySchema } from '../validation/residents.js';
import { errors } from '../lib/errors.js';

export async function list(req: Request, res: Response) {
    const user = req.user!;
    const { houseId } = parseQuery(listResidentsQuerySchema, req);

    if (isEmployee(user)) {
    } else if (isChairman(user)) {
        if (!user.houseId || houseId !== user.houseId) {
            throw errors.forbidden('Председатель может просматривать список жителей только своего дома');
        }
    } else {
        throw errors.forbidden('Действие доступно только сотрудникам УК или председателям ТСЖ');
    }

    const residents = await listResidentsOfHouse(houseId);
    res.json(residents.map(serializeResident));
}